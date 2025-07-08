from rest_framework import serializers
from .models import Presence

class PresenceSerializer(serializers.ModelSerializer):
    user_id = serializers.SerializerMethodField()
    magasin_id = serializers.SerializerMethodField()
    
    class Meta:
        model = Presence
        fields = ['id', 'user', 'user_id', 'magasin', 'magasin_id', 'magasin_nom', 
                 'date_pointage', 'heure_entree', 'heure_sortie', 'pause_entree', 
                 'pause_sortie', 'duree_pause', 'latitude', 'longitude', 'type']
        read_only_fields = ['id', 'user']
    
    def get_user_id(self, obj):
        return str(obj.user.id) if obj.user else None
    
    def get_magasin_id(self, obj):
        return str(obj.magasin.id) if obj.magasin else None
    
    def create(self, validated_data):
        # S'assurer que l'utilisateur est défini
        validated_data['user'] = self.context['request'].user
        
        # S'assurer que le nom du magasin est défini
        if 'magasin_nom' not in validated_data and validated_data.get('magasin'):
            validated_data['magasin_nom'] = validated_data['magasin'].nom
        
        # Log pour debug
        print(f"Création présence avec données: {validated_data}")
        
        return super().create(validated_data)