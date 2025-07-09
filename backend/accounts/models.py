from django.contrib.auth.models import AbstractUser
from django.contrib.auth.models import UserManager as BaseUserManager
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        """
        Crée et sauvegarde un utilisateur avec l'email donné.
        """
        if not email:
            raise ValueError('L\'email est obligatoire')
        
        email = self.normalize_email(email)
        
        # Générer username automatiquement si non fourni
        if not extra_fields.get('username'):
            extra_fields['username'] = email.split('@')[0]
        
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        """
        Crée et sauvegarde un superutilisateur avec l'email donné.
        """
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Le superutilisateur doit avoir is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Le superutilisateur doit avoir is_superuser=True.')
        
        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Administrateur'),
        ('employe', 'Employé'),
    ]
    
    # Utiliser email comme identifiant principal
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, blank=True, null=True)
    
    nom = models.CharField(max_length=100, blank=True)
    prenom = models.CharField(max_length=100, blank=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='employe')
    magasin = models.ForeignKey('stores.Magasin', on_delete=models.SET_NULL, null=True, blank=True)
    image = models.ImageField(upload_to='users/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Utiliser le manager personnalisé
    objects = UserManager()
    
    # Définir email comme champ d'authentification
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['nom', 'prenom']
    
    def __str__(self):
        return f"{self.prenom} {self.nom} ({self.email})"
    
    @property
    def image_url(self):
        if self.image:
            return self.image.url
        return None
    
    def save(self, *args, **kwargs):
        # Générer un username basé sur l'email si vide
        if not self.username:
            self.username = self.email.split('@')[0]
        super().save(*args, **kwargs)

@receiver(post_delete, sender=User)
def delete_user_presences(sender, instance, **kwargs):
    """Supprimer automatiquement les présences quand un utilisateur est supprimé"""
    from attendance.models import Presence
    print(f"=== SUPPRESSION UTILISATEUR ===")
    print(f"Utilisateur supprimé: {instance.email}")
    
    # Supprimer toutes les présences de cet utilisateur
    presences_count = Presence.objects.filter(user=instance).count()
    print(f"Nombre de présences à supprimer: {presences_count}")
    
    Presence.objects.filter(user=instance).delete()
    print(f"✅ {presences_count} présences supprimées pour {instance.email}")