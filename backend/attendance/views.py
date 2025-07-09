from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction
from django.utils import timezone
from datetime import date, datetime
from .models import Presence
from .serializers import PresenceSerializer
import logging

logger = logging.getLogger(__name__)

class PresenceListCreateView(generics.ListCreateAPIView):
    serializer_class = PresenceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['user', 'magasin', 'type']
    ordering = ['-date_pointage', '-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Presence.objects.select_related('user', 'magasin').all()
        else:
            return Presence.objects.select_related('user', 'magasin').filter(user=user)
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        try:
            print(f"=== CRÉATION/MISE À JOUR PRÉSENCE ===")
            print(f"Utilisateur: {request.user.id} ({request.user.email})")
            print(f"Données reçues: {request.data}")
            
            # Vérifier que l'utilisateur a un magasin assigné
            if not request.user.magasin_id:
                return Response({
                    'error': 'Utilisateur non assigné à un magasin'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Récupérer la date du pointage
            date_pointage_str = request.data.get('date_pointage')
            if date_pointage_str:
                date_pointage = datetime.fromisoformat(date_pointage_str.replace('Z', '+00:00')).date()
            else:
                date_pointage = date.today()
            
            print(f"Date de pointage: {date_pointage}")
            
            # Chercher une présence existante pour ce jour
            presence_existante = Presence.objects.filter(
                user=request.user,
                date_pointage=date_pointage
            ).first()
            
            type_pointage = request.data.get('type', 'arrivee')
            print(f"Type de pointage: {type_pointage}")
            
            if presence_existante:
                print(f"Présence existante trouvée: {presence_existante.id}")
                # Mettre à jour la présence existante
                serializer = self.get_serializer(presence_existante, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                
                # Logique de mise à jour selon le type
                now = timezone.now()
                
                if type_pointage == 'arrivee' and not presence_existante.heure_entree:
                    presence_existante.heure_entree = now
                elif type_pointage == 'pause_entree' and presence_existante.heure_entree and not presence_existante.pause_entree:
                    presence_existante.pause_entree = now
                elif type_pointage == 'pause_sortie' and presence_existante.pause_entree and not presence_existante.pause_sortie:
                    presence_existante.pause_sortie = now
                    # Calculer la durée de pause
                    if presence_existante.pause_entree:
                        duree = (now - presence_existante.pause_entree).total_seconds() / 60
                        presence_existante.duree_pause = int(duree)
                elif type_pointage == 'depart' and presence_existante.heure_entree and not presence_existante.heure_sortie:
                    presence_existante.heure_sortie = now
                else:
                    return Response({
                        'error': f'Action {type_pointage} non autorisée dans l\'état actuel'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                presence_existante.type = type_pointage
                presence_existante.latitude = float(request.data.get('latitude', 0))
                presence_existante.longitude = float(request.data.get('longitude', 0))
                presence_existante.save()
                
                print(f"✅ Présence mise à jour: {presence_existante.id}")
                return Response(PresenceSerializer(presence_existante).data, status=status.HTTP_200_OK)
            
            else:
                print("Création d'une nouvelle présence")
                # Créer une nouvelle présence (seulement pour arrivée)
                if type_pointage != 'arrivee':
                    return Response({
                        'error': 'Vous devez d\'abord pointer votre arrivée'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Préparer les données pour la création
                data = request.data.copy()
                data['date_pointage'] = date_pointage
                data['heure_entree'] = timezone.now().isoformat()
                
                serializer = self.get_serializer(data=data)
                serializer.is_valid(raise_exception=True)
                presence = serializer.save()
                
                print(f"✅ Nouvelle présence créée: {presence.id}")
                return Response(serializer.data, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            print(f"❌ Erreur création/mise à jour présence: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class PresenceDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PresenceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Presence.objects.select_related('user', 'magasin').all()
        else:
            return Presence.objects.select_related('user', 'magasin').filter(user=user)
    
    @transaction.atomic
    def update(self, request, *args, **kwargs):
        try:
            print(f"=== MISE À JOUR PRÉSENCE DIRECTE ===")
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