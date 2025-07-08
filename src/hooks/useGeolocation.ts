import { useState, useCallback } from 'react';

interface Position {
  latitude: number;
  longitude: number;
}

export const useGeolocation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentPosition = useCallback((): Promise<Position> => {
    setLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const errorMsg = 'La géolocalisation n\'est pas supportée par ce navigateur';
        setError(errorMsg);
        setLoading(false);
        reject(new Error(errorMsg));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Position GPS obtenue:', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          
          setLoading(false);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error('Erreur géolocalisation:', error);
          setLoading(false);
          let errorMsg = 'Erreur de géolocalisation';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMsg = 'Permission de géolocalisation refusée';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg = 'Position non disponible';
              break;
            case error.TIMEOUT:
              errorMsg = 'Délai d\'attente dépassé pour la géolocalisation';
              break;
          }
          
          setError(errorMsg);
          reject(new Error(errorMsg));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    });
  }, []);

  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }, []);

  return {
    getCurrentPosition,
    calculateDistance,
    loading,
    error
  };
};