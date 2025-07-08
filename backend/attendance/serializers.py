from rest_framework import serializers
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
                 'pause_sortie', 'duree_pause', 'latitude', 'longitude', 'type']
        read_only_fields = ['id', 'user']
    
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
        
        validated_data['user'] = self.context['request'].user
        print(f"Utilisateur assigné: {validated_data['user'].email}")
        
        # Assurer que le nom du magasin est défini
        if 'magasin_nom' not in validated_data and validated_data.get('magasin'):
            from stores.models import Magasin
            try:
                magasin = Magasin.objects.get(id=validated_data['magasin'])
                validated_data['magasin_nom'] = magasin.nom
                print(f"Nom magasin défini: {magasin.nom}")
            except Magasin.DoesNotExist:
                validated_data['magasin_nom'] = 'Magasin inconnu'
        
        print(f"Données finales: {validated_data}")
        result = super().create(validated_data)
        print(f"✅ Présence créée dans serializer: {result.id}")
        
        return result