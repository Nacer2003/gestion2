from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
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
    
    def create(self, request, *args, **kwargs):
        try:
            logger.info(f"Création de présence pour utilisateur {request.user.id}")
            logger.info(f"Données reçues: {request.data}")
            
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            presence = serializer.save()
            
            logger.info(f"Présence créée avec succès: ID={presence.id}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Erreur lors de la création de la présence: {str(e)}")
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
    
    def update(self, request, *args, **kwargs):
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            presence = serializer.save()
            logger.info(f"Présence modifiée avec succès")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de la modification de la présence: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)