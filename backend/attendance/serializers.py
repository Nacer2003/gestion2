from rest_framework import serializers
from django.utils import timezone
from datetime import date
from .models import Presence

class PresenceSerializer(serializers.ModelSerializer):
    user_id = serializers.SerializerMethodField()
    magasin_id = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()
    user_nom = serializers.SerializerMethodField()
    user_prenom = serializers.SerializerMethodField()
    
    class Meta:
        model = Presence
        fields = ['id', 'user', 'user_id', 'user_email', 'user_nom', 'user_prenom', 
                 'magasin', 'magasin_id', 'magasin_nom', 
                 'date_pointage', 'heure_entree', 'heure_sortie', 'pause_entree', 
                 'pause_sortie', 'duree_pause', 'latitude', 'longitude', 'type',
                 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
    
    def get_user_id(self, obj):
        return str(obj.user.id) if obj.user else None
    
    def get_magasin_id(self, obj):
        return str(obj.magasin.id) if obj.magasin else None
    
    def get_user_email(self, obj):
        return obj.user.email if obj.user else 'Email inconnu'
    
    def get_user_nom(self, obj):
        return obj.user.nom if obj.user else 'Nom inconnu'
    
    def get_user_prenom(self, obj):
        return obj.user.prenom if obj.user else 'Prénom inconnu'
    
    def create(self, validated_data):
        print(f"=== SERIALIZER CREATE ===")
        print(f"Données validées: {validated_data}")
        
        # Assigner l'utilisateur actuel
        validated_data['user'] = self.context['request'].user
        user = validated_data['user']
        print(f"Utilisateur assigné: {user.email}")
        
        # Assigner le magasin de l'utilisateur
        if user.magasin_id:
            from stores.models import Magasin
            try:
                magasin = Magasin.objects.get(id=user.magasin_id)
                validated_data['magasin'] = magasin
                validated_data['magasin_nom'] = magasin.nom
                print(f"Magasin assigné: {magasin.nom}")
            except Magasin.DoesNotExist:
                validated_data['magasin_nom'] = 'Magasin inconnu'
        
        # Assurer que la date de pointage est définie
        if 'date_pointage' not in validated_data:
            validated_data['date_pointage'] = date.today()
        
        # Si c'est une arrivée, définir l'heure d'entrée
        if validated_data.get('type') == 'arrivee' and 'heure_entree' not in validated_data:
            validated_data['heure_entree'] = timezone.now()
        
        print(f"Données finales: {validated_data}")
        result = super().create(validated_data)
        print(f"✅ Présence créée dans serializer: {result.id}")
        
        return result
    
    def update(self, instance, validated_data):
        print(f"=== SERIALIZER UPDATE ===")
        print(f"Instance ID: {instance.id}")
        print(f"Données validées: {validated_data}")
        
        # Mettre à jour les champs selon le type
        type_pointage = validated_data.get('type', instance.type)
        now = timezone.now()
        
        if type_pointage == 'arrivee' and not instance.heure_entree:
            validated_data['heure_entree'] = now
        elif type_pointage == 'pause_entree' and instance.heure_entree and not instance.pause_entree:
            validated_data['pause_entree'] = now
        elif type_pointage == 'pause_sortie' and instance.pause_entree and not instance.pause_sortie:
            validated_data['pause_sortie'] = now
            # Calculer la durée de pause
            if instance.pause_entree:
                duree = (now - instance.pause_entree).total_seconds() / 60
                validated_data['duree_pause'] = int(duree)
        elif type_pointage == 'depart' and instance.heure_entree and not instance.heure_sortie:
            validated_data['heure_sortie'] = now
        
        result = super().update(instance, validated_data)
        print(f"✅ Présence mise à jour dans serializer: {result.id}")
        
        return result