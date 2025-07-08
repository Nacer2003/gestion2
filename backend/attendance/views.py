from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction
from .models import Presence
from .serializers import PresenceSerializer
import logging

logger = logging.getLogger(__name__)

class PresenceListCreateView(generics.ListCreateAPIView):
    serializer_class = PresenceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['user', 'magasin', 'type']
    ordering = ['-date_pointage']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Presence.objects.all()
        else:
            return Presence.objects.filter(user=user)
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        try:
            print(f"=== CRÉATION PRÉSENCE ===")
            print(f"Utilisateur: {request.user.id} ({request.user.email})")
            print(f"Données reçues: {request.data}")
            
            # Vérifier que l'utilisateur a un magasin assigné
            if not request.user.magasin_id:
                return Response({
                    'error': 'Utilisateur non assigné à un magasin'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Préparer les données avec l'utilisateur
            data = request.data.copy()
            
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            presence = serializer.save()
            
            print(f"✅ Présence créée: ID={presence.id}, User={presence.user.email}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            print(f"❌ Erreur création présence: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class PresenceDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PresenceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Presence.objects.all()
        else:
            return Presence.objects.filter(user=user)
    
    @transaction.atomic
    def update(self, request, *args, **kwargs):
        try:
            print(f"=== MISE À JOUR PRÉSENCE ===")
            print(f"Données reçues: {request.data}")
            
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            presence = serializer.save()
            
            print(f"✅ Présence mise à jour: ID={presence.id}")
            return Response(serializer.data)
            
        except Exception as e:
            print(f"❌ Erreur mise à jour présence: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)