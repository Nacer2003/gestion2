import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Package, AlertCircle } from 'lucide-react';
import { stockService, productsService, storesService, attendanceService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useGeolocation } from '../../hooks/useGeolocation';
import { Stock, Produit, Magasin, Presence } from '../../types';

export const EmployeDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { getCurrentPosition, calculateDistance, loading: geoLoading, error: geoError } = useGeolocation();
  const [magasin, setMagasin] = useState<Magasin | null>(null);
  const [stats, setStats] = useState({
    totalProduits: 0,
    produitsAlertes: 0
  });
  const [pointageLoading, setPointageLoading] = useState(false);
  const [pointageMessage, setPointageMessage] = useState('');
  const [todayPresence, setTodayPresence] = useState<Presence | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.magasin_id) return;

      try {
        // Récupérer le magasin de l'employé
        const magasinsData = await storesService.getStores();
        const userMagasin = magasinsData.find((m: any) => m.id.toString() === user.magasin_id);
        if (userMagasin) {
          setMagasin({
            ...userMagasin,
            createdAt: new Date(userMagasin.created_at)
          });
        }

        // Récupérer les stocks du magasin
        const stocksData = await stockService.getStocks();
        const stocks = stocksData
          .filter((stock: any) => stock.magasin_id?.toString() === user.magasin_id)
          .map((item: any) => ({
            ...item,
            updatedAt: new Date(item.updated_at)
          })) as Stock[];

        // Récupérer les produits pour vérifier les alertes
        const produitsData = await productsService.getProducts();
        const produits = produitsData.map((item: any) => ({
          ...item,
          createdAt: new Date(item.created_at)
        })) as Produit[];

        let produitsAlertes = 0;
        stocks.forEach(stock => {
          const produit = produits.find(p => p.id.toString() === stock.produit_id.toString());
          if (produit && stock.quantite <= produit.seuil_alerte) {
            produitsAlertes++;
          }
        });

        setStats({
          totalProduits: stocks.length,
          produitsAlertes
        });

        // Récupérer la présence du jour
        const presencesData = await attendanceService.getAttendance();
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
          })) as Presence[];

        const today = new Date();
        const todayPresenceData = userPresences.find(p => {
          const pointageDate = p.date_pointage;
          return pointageDate.toDateString() === today.toDateString();
        });

        if (todayPresenceData) {
          setTodayPresence(todayPresenceData);
        }

      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      }
    };

    fetchData();
  }, [user]);

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

  const handlePointage = async () => {
    if (!user || !magasin) return;

    setPointageLoading(true);
    setPointageMessage('');

    try {
      console.log('=== POINTAGE DASHBOARD ===');
      console.log('Magasin:', magasin.nom);
      console.log('Coordonnées magasin:', { lat: magasin.latitude, lng: magasin.longitude });

      const position = await getCurrentPosition();
      console.log('Position utilisateur:', { lat: position.latitude, lng: position.longitude });

      const distance = calculateDistance(
        position.latitude,
        position.longitude,
        magasin.latitude,
        magasin.longitude
      );

      const allowedRadius = getGpsRadius();
      console.log('Distance:', distance, 'Rayon autorisé:', allowedRadius);

      if (distance > allowedRadius) {
        setPointageMessage(`❌ Vous êtes trop loin du magasin (${Math.round(distance)}m). Vous devez être dans un rayon de ${allowedRadius}m.`);
        return;
      }

      // Vérifier s'il y a déjà un pointage aujourd'hui
      if (todayPresence?.heure_entree) {
        setPointageMessage('✅ Vous avez déjà pointé aujourd\'hui.');
        return;
      }

      const pointageData = {
        magasin: magasin.id,
        magasin_nom: magasin.nom,
        date_pointage: new Date().toISOString(),
        latitude: position.latitude,
        longitude: position.longitude,
        type: 'arrivee'
      };

      console.log('Envoi pointage:', pointageData);
      await attendanceService.createAttendance(pointageData);

      setPointageMessage('✅ Pointage enregistré avec succès !');
      
      // Mettre à jour la présence locale
      const newPresence: Presence = {
        id: Date.now().toString(),
        user_id: user.id,
        magasin_id: magasin.id,
        magasin_nom: magasin.nom,
        date_pointage: new Date(),
        heure_entree: new Date(),
        heure_sortie: null,
        pause_entree: null,
        pause_sortie: null,
        duree_pause: null,
        latitude: position.latitude,
        longitude: position.longitude,
        type: 'arrivee'
      };
      
      setTodayPresence(newPresence);

    } catch (error: any) {
      console.error('❌ Erreur pointage dashboard:', error);
      let errorMessage = 'Erreur lors du pointage';
      
      if (error.message?.includes('Permission de géolocalisation refusée')) {
        errorMessage = '🚫 Permission de géolocalisation refusée. Veuillez autoriser l\'accès à votre position.';
      } else if (error.message?.includes('Position GPS non disponible')) {
        errorMessage = '📡 Position GPS non disponible. Vérifiez que le GPS est activé.';
      } else if (error.message?.includes('Délai d\'attente dépassé')) {
        errorMessage = '⏱️ Délai d\'attente dépassé pour obtenir votre position GPS.';
      }
      
      setPointageMessage(errorMessage);
    } finally {
      setPointageLoading(false);
    }
  };

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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Employé</h1>
        <p className="text-gray-600 mt-2">Bienvenue, {user?.prenom} {user?.nom}</p>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Produits en stock</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProduits}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Alertes stock</p>
              <p className="text-2xl font-bold text-gray-900">{stats.produitsAlertes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <MapPin className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Magasin</p>
              <p className="text-lg font-bold text-gray-900">{magasin?.nom || 'Non assigné'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section pointage */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">⏰ Pointage Rapide</h2>
          <Clock className="h-6 w-6 text-gray-400" />
        </div>

        {todayPresence?.heure_entree ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-medium">✅ Pointage effectué aujourd'hui</p>
            <p className="text-green-600 text-sm">
              Arrivée: {todayPresence.heure_entree.toLocaleString('fr-FR')}
            </p>
            {todayPresence.heure_sortie && (
              <p className="text-green-600 text-sm">
                Départ: {todayPresence.heure_sortie.toLocaleString('fr-FR')}
              </p>
            )}
            <div className="mt-3">
              <button
                onClick={() => navigate('/employe/pointage')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Gérer mes pointages
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              📍 Vous pouvez pointer votre arrivée. Assurez-vous d'être dans un rayon de {getGpsRadius()}m du magasin.
            </p>
            
            {magasin && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                <p><strong>📍 Magasin:</strong> {magasin.nom}</p>
                <p><strong>🎯 Rayon autorisé:</strong> {getGpsRadius()}m</p>
              </div>
            )}

            <button
              onClick={handlePointage}
              disabled={pointageLoading || geoLoading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {pointageLoading || geoLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {geoLoading ? 'Obtention position GPS...' : 'Pointage en cours...'}
                </div>
              ) : (
                '✅ Pointer mon arrivée'
              )}
            </button>

            {pointageMessage && (
              <div className={`p-4 rounded-lg ${
                pointageMessage.includes('succès') || pointageMessage.includes('✅')
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {pointageMessage}
              </div>
            )}

            {geoError && (
              <div className="bg-red-50 text-red-800 p-4 rounded-lg border border-red-200">
                <p className="font-medium">❌ Erreur de géolocalisation</p>
                <p className="text-sm">{geoError}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions rapides */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">🚀 Actions rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={() => navigate('/employe/stock')}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors duration-200"
          >
            <Package className="h-6 w-6 text-blue-600 mb-2" />
            <h3 className="font-medium text-gray-900">📦 Consulter le stock</h3>
            <p className="text-sm text-gray-600">Voir les produits disponibles</p>
          </button>
          <button 
            onClick={() => navigate('/employe/pointage')}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors duration-200"
          >
            <Clock className="h-6 w-6 text-green-600 mb-2" />
            <h3 className="font-medium text-gray-900">⏰ Gérer le pointage</h3>
            <p className="text-sm text-gray-600">Pointer votre présence complète</p>
          </button>
        </div>
      </div>
    </div>
  );
};