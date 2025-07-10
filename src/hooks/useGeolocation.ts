import { useState, useCallback } from 'react';

interface Position {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export const useGeolocation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentPosition = useCallback((): Promise<Position> => {
    setLoading(true);
    setError(null);

    console.log('=== HOOK: Demande géolocalisation HAUTE PRÉCISION ===');
    
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const errorMsg = 'La géolocalisation n\'est pas supportée par ce navigateur';
        console.error('❌', errorMsg);
        setError(errorMsg);
        setLoading(false);
        reject(new Error(errorMsg));
        return;
      }

      // Fonction pour essayer d'obtenir la position avec différents niveaux de précision
      const tryGetPosition = (highAccuracy: boolean, timeout: number) => {
        return new Promise<Position>((resolvePos, rejectPos) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log(`✅ HOOK: Position GPS obtenue (highAccuracy: ${highAccuracy}):`, {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date(position.timestamp).toLocaleString(),
                altitude: position.coords.altitude,
                heading: position.coords.heading,
                speed: position.coords.speed
              });
              
              resolvePos({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
              });
            },
            (error) => {
              console.error(`❌ HOOK: Erreur géolocalisation (highAccuracy: ${highAccuracy}):`, {
                code: error.code,
                message: error.message,
                timestamp: new Date().toLocaleString()
              });
              rejectPos(error);
            },
            {
              enableHighAccuracy: highAccuracy,
              timeout: timeout,
              maximumAge: 0
            }
          );
        });
      };

      // Essayer d'abord avec haute précision, puis fallback
      tryGetPosition(true, 30000)
        .then((position) => {
          setLoading(false);
          resolve(position);
        })
        .catch((error) => {
          console.log('⚠️ Tentative avec précision normale...');
          
          // Fallback avec précision normale
          tryGetPosition(false, 15000)
            .then((position) => {
              console.log('✅ Position obtenue avec précision normale');
              setLoading(false);
              resolve(position);
            })
            .catch((fallbackError) => {
              console.error('❌ HOOK: Toutes les tentatives ont échoué');
              setLoading(false);
              
              let errorMsg = 'Erreur de géolocalisation';
              switch (fallbackError.code) {
                case fallbackError.PERMISSION_DENIED:
                  errorMsg = 'Permission de géolocalisation refusée. Veuillez autoriser l\'accès à votre position.';
                  break;
                case fallbackError.POSITION_UNAVAILABLE:
                  errorMsg = 'Position GPS non disponible. Vérifiez que le GPS est activé.';
                  break;
                case fallbackError.TIMEOUT:
                  errorMsg = 'Délai d\'attente dépassé. Vérifiez votre connexion GPS.';
                  break;
              }
              
              setError(errorMsg);
              reject(new Error(errorMsg));
            });
        });
    });
  }, []);

  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    console.log('=== CALCUL DISTANCE PRÉCIS ===');
    console.log('Position utilisateur:', { lat: lat1, lng: lon1 });
    console.log('Position magasin:', { lat: lat2, lng: lon2 });
    
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;
    console.log('✅ Distance calculée:', Math.round(distance), 'mètres');
    
    return distance;
  }, []);

  return {
    getCurrentPosition,
    calculateDistance,
    loading,
    error
  };
};