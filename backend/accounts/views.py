from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db import transaction
from attendance.models import Presence
from .models import User
from .serializers import (
    UserSerializer, 
    UserCreateSerializer, 
    CustomTokenObtainPairSerializer,
    LoginSerializer
)

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        
        try:
            serializer.is_valid(raise_exception=True)
        except Exception as e:
            return Response({
                'error': 'Email ou mot de passe incorrect',
                'details': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Récupérer l'utilisateur
        email = request.data.get('email')
        user = User.objects.select_related('magasin').filter(email=email).first()
        
        if not user:
            return Response({
                'error': 'Utilisateur non trouvé'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Générer les tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        })

class UserListCreateView(generics.ListCreateAPIView):
    queryset = User.objects.select_related('magasin').all().order_by('-date_joined')
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer
    
    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            with transaction.atomic():
                user = serializer.save()
                
                return Response(
                    UserSerializer(user).data,
                    status=status.HTTP_201_CREATED
                )
                
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.select_related('magasin').all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def destroy(self, request, *args, **kwargs):
        """Supprimer l'utilisateur et son historique de présence"""
        try:
            instance = self.get_object()
            
            with transaction.atomic():
                # Supprimer toutes les présences de cet utilisateur
                Presence.objects.filter(user=instance).delete()
                
                # Supprimer l'utilisateur
                instance.delete()
                
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except Exception as e:
            return Response({
                'error': f'Erreur lors de la suppression: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, *args, **kwargs):
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            
            with transaction.atomic():
                user = serializer.save()
                
                return Response(UserSerializer(user).data)
                
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def current_user_view(request):
    # S'assurer que la relation magasin est chargée
    user = User.objects.select_related('magasin').get(id=request.user.id)
    serializer = UserSerializer(user)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    try:
        refresh_token = request.data.get("refresh")
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        return Response({"message": "Déconnexion réussie"}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": "Token invalide"}, status=status.HTTP_400_BAD_REQUEST)