import React, { useState, useEffect } from 'react';
import { MapPin, Clock, CheckCircle, AlertCircle, Calendar, Coffee, LogOut, LogIn, Pause } from 'lucide-react';
import { attendanceService, storesService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useGeolocation } from '../../hooks/useGeolocation';
import { Presence, Magasin } from '../../types';
import toast from 'react-hot-toast';

export const PointagePage: React.FC = () => {
  const { user } = useAuth();
  const { getCurrentPosition, calculateDistance, loading: geoLoading, error: geoError } = useGeolocation();
  const [magasin, setMagasin] = useState<Magasin | null>(null);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [loading, setLoading] = useState(true);
  const [pointageLoading, setPointageLoading] = useState(false);
  const [todayPresence, setTodayPresence] = useState<Presence | null>(null);
  const [currentStatus, setCurrentStatus] = useState<'absent' | 'present' | 'pause'>('absent');

  useEffect(() => {
    if (user?.magasin_id) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchData = async () => {
    if (!user?.magasin_id) return;

    try {
      console.log('=== FETCH DATA POINTAGE ===');
      console.log('User magasin_id:', user.magasin_id);
      
      // Récupérer le magasin
      const magasinsData = await storesService.getStores();
      const userMagasin = magasinsData.find((m: any) => m.id.toString() === user.magasin_id);
      
      if (userMagasin) {
        console.log('✅ Magasin trouvé:', userMagasin.nom);
        console.log('Coordonnées magasin:', { lat: userMagasin.latitude, lng: userMagasin.longitude });
        setMagasin({
          ...userMagasin,
          createdAt: new Date(userMagasin.created_at)
        });
      } else {
        console.error('❌ Magasin non trouvé pour ID:', user.magasin_id);
      }

      // Récupérer l'historique des présences
      const presencesData = await attendanceService.getAttendance();
      console.log('Présences reçues:', presencesData.length);
      
      const userPresences = presencesData
        .filter((p: any) => p.user_id?.toString() === user.id?.toString())
        .map((item: any) => ({
          ...item,
          id: item.id?.toString(),
          user_id: item.user_id?.toString(),
          magasin_id: item.magasin_id?.toString(),
          date_pointage: new Date(item.date_pointage),
          heure_entree: item.heure_entree ? new Date(item.heure_entree) : null,
          heure_sortie: item.heure_sortie ? new Date(item.heure_sortie) : null,
          pause_entree: item.pause_entree ? new Date(item.pause_entree) : null,
          pause_sortie: item.pause_sortie ? new Date(item.pause_sortie) : null
        }))
        .sort((a: any, b: any) => b.date_pointage.getTime() - a.date_pointage.getTime()) as Presence[];

      console.log('✅ Présences utilisateur filtrées:', userPresences.length);
      setPresences(userPresences);

      // Vérifier le statut actuel
      const today = new Date();
      const todayPresenceData = userPresences.find(p => {
        const pointageDate = p.date_pointage;
        return pointageDate.toDateString() === today.toDateString();
      });

      setTodayPresence(todayPresenceData || null);
      console.log('Présence du jour:', todayPresenceData);

      // Déterminer le statut actuel
      if (todayPresenceData) {
        if (todayPresenceData.heure_sortie) {
          setCurrentStatus('absent');
        } else if (todayPresenceData.pause_entree && !todayPresenceData.pause_sortie) {
          setCurrentStatus('pause');
        } else {
          setCurrentStatus('present');
        }
      } else {
        setCurrentStatus('absent');
      }
      
      console.log('✅ Statut actuel déterminé:', currentStatus);

    } catch (error) {
      console.error('❌ Erreur lors du chargement des données:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Charger les paramètres depuis localStorage
  const getGpsRadius = () => {
    try {
      const savedSettings = localStorage.getItem('stockpro_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        return settings.gpsRadius || 100;
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error);
    }
    return 100; // Valeur par défaut
  };

  const handlePointage = async (type: 'arrivee' | 'depart' | 'pause_entree' | 'pause_sortie') => {
    if (!user || !magasin) {
      toast.error('Informations utilisateur ou magasin manquantes');
      return;
    }

    console.log('=== DÉBUT POINTAGE ===');
    console.log('Type:', type);
    console.log('User:', user.email);
    console.log('Magasin:', magasin.nom);
    console.log('Coordonnées magasin:', { lat: magasin.latitude, lng: magasin.longitude });
    
    // Vérifications des conditions AVANT la géolocalisation
    if (type === 'arrivee' && todayPresence?.heure_entree) {
      toast.error('Vous avez déjà pointé votre arrivée aujourd\'hui');
      return;
    }

    if (type === 'pause_entree') {
      if (!todayPresence || !todayPresence.heure_entree) {
        toast.error('Vous devez d\'abord pointer votre arrivée');
        return;
      }
      if (todayPresence.pause_entree) {
        toast.error('Vous avez déjà commencé votre pause');
        return;
      }
    }

    if (type === 'pause_sortie') {
      if (!todayPresence || !todayPresence.pause_entree) {
        toast.error('Vous devez d\'abord commencer votre pause');
        return;
      }
      if (todayPresence.pause_sortie) {
        toast.error('Vous avez déjà terminé votre pause');
        return;
      }
    }

    if (type === 'depart') {
      if (!todayPresence || !todayPresence.heure_entree) {
        toast.error('Vous devez d\'abord pointer votre arrivée');
        return;
      }
      if (todayPresence.heure_sortie) {
        toast.error('Vous avez déjà pointé votre départ');
        return;
      }
    }

    setPointageLoading(true);

    try {
      console.log('🔍 Obtention position GPS haute précision...');
      
      // Obtenir la position GPS avec retry et haute précision
      const position = await getCurrentPosition();
      
      console.log('✅ Position GPS obtenue:', {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy
      });
      
      // Calculer la distance avec les coordonnées du magasin
      const distance = calculateDistance(
        position.latitude,
        position.longitude,
        magasin.latitude,
        magasin.longitude
      );

      const allowedRadius = getGpsRadius();
      console.log('📏 Vérification distance:', {
        distance: Math.round(distance),
        allowedRadius,
        isWithinRadius: distance <= allowedRadius
      });
      
      if (distance > allowedRadius) {
        const errorMsg = `❌ Vous êtes trop loin du magasin (${Math.round(distance)}m). Vous devez être dans un rayon de ${allowedRadius}m.`;
        console.error(errorMsg);
        toast.error(errorMsg);
        return;
      }

      console.log('✅ Position validée, envoi du pointage...');

      const now = new Date();
      const pointageData = {
        magasin: magasin.id,
        magasin_nom: magasin.nom,
        date_pointage: now.toISOString(),
        latitude: position.latitude,
        longitude: position.longitude,
        type: type
      };
      
      console.log('📤 Données pointage:', pointageData);
      
      const result = await attendanceService.createAttendance(pointageData);
      console.log('✅ Pointage enregistré:', result);
      
      const messages = {
        arrivee: '✅ Arrivée enregistrée avec succès !',
        depart: '✅ Départ enregistré avec succès !',
        pause_entree: '✅ Début de pause enregistré !',
        pause_sortie: '✅ Fin de pause enregistrée !'
      };
      
      toast.success(messages[type]);

      // Recharger les données après un délai
      console.log('🔄 Rechargement des données...');
      setTimeout(() => {
        fetchData();
      }, 1000);

    } catch (error: any) {
      console.error('❌ Erreur pointage complète:', error);
      
      // Messages d'erreur plus spécifiques
      let errorMessage = 'Erreur lors du pointage';
      
      if (error.message?.includes('Permission de géolocalisation refusée')) {
        errorMessage = '🚫 Permission de géolocalisation refusée. Veuillez autoriser l\'accès à votre position dans les paramètres du navigateur.';
      } else if (error.message?.includes('Position GPS non disponible')) {
        errorMessage = '📡 Position GPS non disponible. Vérifiez que le GPS est activé sur votre appareil.';
      } else if (error.message?.includes('Délai d\'attente dépassé')) {
        errorMessage = '⏱️ Délai d\'attente dépassé pour obtenir votre position GPS. Réessayez.';
      } else if (error.message?.includes('géolocalisation')) {
        errorMessage = error.message;
      } else {
        errorMessage = '❌ Erreur lors du pointage. Vérifiez votre connexion et réessayez.';
      }
      
      toast.error(errorMessage);
    } finally {
      setPointageLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const canDoAction = (action: string) => {
    if (!todayPresence) return action === 'arrivee';
    
    switch (action) {
      case 'arrivee':
        return !todayPresence.heure_entree;
      case 'pause_entree':
        return todayPresence.heure_entree && !todayPresence.pause_entree;
      case 'pause_sortie':
        return todayPresence.pause_entree && !todayPresence.pause_sortie;
      case 'depart':
        return todayPresence.heure_entree && !todayPresence.heure_sortie;
      default:
        return false;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user?.magasin_id) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun magasin assigné</h3>
        <p className="text-gray-600">Contactez votre administrateur pour être assigné à un magasin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Pointage</h1>
        <p className="text-gray-600 mt-1">Gérez vos heures de présence</p>
      </div>

      {/* Statut actuel */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Statut actuel</h2>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            currentStatus === 'present' ? 'bg-green-100 text-green-800' :
            currentStatus === 'pause' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {currentStatus === 'present' ? '✅ Présent' :
             currentStatus === 'pause' ? '☕ En pause' : '❌ Absent'}
          </div>
        </div>

        <div className="flex items-center text-sm text-gray-500 mb-4">
          <Calendar className="h-4 w-4 mr-1" />
          {new Date().toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>

        <div className="flex items-center text-gray-600 mb-6">
          <MapPin className="h-5 w-5 mr-2" />
          <span>
            📍 Magasin: <strong>{magasin?.nom || 'Non assigné'}</strong> 
            <span className="text-sm text-gray-500 ml-2">
              (Rayon autorisé: {getGpsRadius()}m)
            </span>
          </span>
        </div>

        {/* Informations de débogage pour l'admin */}
        {magasin && (
          <div className="bg-gray-50 rounded-lg p-3 mb-6 text-xs text-gray-600">
            <p><strong>Debug Info:</strong></p>
            <p>Magasin ID: {magasin.id}</p>
            <p>Coordonnées: {magasin.latitude.toFixed(6)}, {magasin.longitude.toFixed(6)}</p>
            <p>User ID: {user.id}</p>
          </div>
        )}

        {/* Boutons de pointage */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => handlePointage('arrivee')}
            disabled={pointageLoading || geoLoading || !canDoAction('arrivee')}
            className={`flex flex-col items-center p-4 border-2 rounded-lg transition-colors ${
              canDoAction('arrivee') 
                ? 'border-green-300 hover:bg-green-50 text-green-700' 
                : 'border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <LogIn className="h-6 w-6 mb-2" />
            <span className="text-sm font-medium">Arrivée</span>
            {todayPresence?.heure_entree && (
              <span className="text-xs mt-1 text-green-600">
                ✓ {todayPresence.heure_entree.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </button>

          <button
            onClick={() => handlePointage('pause_entree')}
            disabled={pointageLoading || geoLoading || !canDoAction('pause_entree')}
            className={`flex flex-col items-center p-4 border-2 rounded-lg transition-colors ${
              canDoAction('pause_entree') 
                ? 'border-yellow-300 hover:bg-yellow-50 text-yellow-700' 
                : 'border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Coffee className="h-6 w-6 mb-2" />
            <span className="text-sm font-medium">Début pause</span>
            {todayPresence?.pause_entree && (
              <span className="text-xs mt-1 text-yellow-600">
                ✓ {todayPresence.pause_entree.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </button>

          <button
            onClick={() => handlePointage('pause_sortie')}
            disabled={pointageLoading || geoLoading || !canDoAction('pause_sortie')}
            className={`flex flex-col items-center p-4 border-2 rounded-lg transition-colors ${
              canDoAction('pause_sortie') 
                ? 'border-orange-300 hover:bg-orange-50 text-orange-700' 
                : 'border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Pause className="h-6 w-6 mb-2" />
            <span className="text-sm font-medium">Fin pause</span>
            {todayPresence?.pause_sortie && (
              <span className="text-xs mt-1 text-orange-600">
                ✓ {todayPresence.pause_sortie.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </button>

          <button
            onClick={() => handlePointage('depart')}
            disabled={pointageLoading || geoLoading || !canDoAction('depart')}
            className={`flex flex-col items-center p-4 border-2 rounded-lg transition-colors ${
              canDoAction('depart') 
                ? 'border-red-300 hover:bg-red-50 text-red-700' 
                : 'border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <LogOut className="h-6 w-6 mb-2" />
            <span className="text-sm font-medium">Départ</span>
            {todayPresence?.heure_sortie && (
              <span className="text-xs mt-1 text-red-600">
                ✓ {todayPresence.heure_sortie.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </button>
        </div>

        {(pointageLoading || geoLoading) && (
          <div className="mt-4 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
            <span>
              {geoLoading ? '📡 Obtention position GPS...' : '💾 Enregistrement du pointage...'}
            </span>
          </div>
        )}

        {geoError && (
          <div className="mt-4 bg-red-50 text-red-800 p-4 rounded-lg border border-red-200 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <div>
              <p className="font-medium">Erreur de géolocalisation</p>
              <p className="text-sm">{geoError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Résumé du jour */}
      {todayPresence && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Résumé du jour</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Arrivée</p>
              <p className="text-lg font-semibold text-green-600">
                {todayPresence.heure_entree?.toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit'
                }) || '-'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Départ</p>
              <p className="text-lg font-semibold text-red-600">
                {todayPresence.heure_sortie?.toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit'
                }) || '-'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Pause</p>
              <p className="text-lg font-semibold text-yellow-600">
                {todayPresence.pause_entree?.toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit'
                }) || '-'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Durée pause</p>
              <p className="text-lg font-semibold text-orange-600">
                {todayPresence.duree_pause ? formatDuration(todayPresence.duree_pause) : '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Historique des présences */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">📅 Historique des présences</h2>
        </div>

        {presences.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Magasin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Arrivée
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Départ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pause
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Durée pause
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {presences.slice(0, 10).map((presence) => (
                  <tr key={presence.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {presence.date_pointage.toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {presence.magasin_nom || 'Magasin inconnu'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      {presence.heure_entree?.toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      }) || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      {presence.heure_sortie?.toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      }) || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                      {presence.pause_entree?.toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      }) || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                      {presence.duree_pause ? formatDuration(presence.duree_pause) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun pointage enregistré</h3>
            <p className="text-gray-600">Votre historique de présences apparaîtra ici.</p>
          </div>
        )}
      </div>
    </div>
  );
};