import React, { useState, useEffect, useRef } from 'react';
import { Bell, Package, TrendingUp, TrendingDown, X, User as UserIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { stockService, productsService, storesService, authService } from '../services/api';
import { normalizeApiResponse } from '../config/api';
import { Mouvement, Produit, Magasin, User } from '../types';

interface Notification {
  id: string;
  type: 'stock_movement';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  user_name?: string;
}

export const NotificationWidget: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [magasins, setMagasins] = useState<Magasin[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer les notifications quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const fetchData = async () => {
      try {
        const [produitsData, magasinsData, usersData, mouvementsData] = await Promise.all([
          productsService.getProducts(),
          storesService.getStores(),
          authService.getUsers(),
          stockService.getMovements()
        ]);

        // Normaliser toutes les réponses
        const normalizedProduits = normalizeApiResponse(produitsData);
        const normalizedMagasins = normalizeApiResponse(magasinsData);
        const normalizedUsers = normalizeApiResponse(usersData);
        const normalizedMouvements = normalizeApiResponse(mouvementsData);

        setProduits(normalizedProduits.map((item: any) => ({ ...item, createdAt: new Date(item.created_at) })) as Produit[]);
        setMagasins(normalizedMagasins.map((item: any) => ({ ...item, createdAt: new Date(item.created_at) })) as Magasin[]);
        setUsers(normalizedUsers.map((item: any) => ({ ...item, createdAt: new Date(item.date_joined || item.created_at) })) as User[]);

        // Traiter les mouvements récents (dernières 24h)
        const newNotifications: Notification[] = [];
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const recentMovements = normalizedMouvements
          .map((item: any) => ({ ...item, date: new Date(item.date) }))
          .filter((mouvement: any) => mouvement.date >= yesterday)
          .sort((a: any, b: any) => b.date.getTime() - a.date.getTime())
          .slice(0, 20);

        console.log('Mouvements récents trouvés:', recentMovements.length);

        recentMovements.forEach((mouvement: any) => {
          const produit = normalizedProduits.find((p: any) => p.id.toString() === mouvement.produit_id?.toString());
          const magasin = normalizedMagasins.find((m: any) => m.id.toString() === mouvement.magasin_id?.toString());
          const userMouvement = normalizedUsers.find((u: any) => u.id.toString() === mouvement.user_id?.toString());

          console.log('Mouvement:', {
            produit: produit?.nom,
            magasin: magasin?.nom,
            user: userMouvement?.email,
            type: mouvement.type,
            quantite: mouvement.quantite
          });

          // Afficher les mouvements de tous les utilisateurs (admin et employés)
          if (produit && magasin && userMouvement) {
            newNotifications.push({
              id: mouvement.id.toString(),
              type: 'stock_movement',
              title: `Mouvement de stock - ${produit.nom}`,
              message: `${mouvement.type === 'entrée' ? 'Entrée' : 'Sortie'} de ${mouvement.quantite} unités dans ${magasin.nom} (${mouvement.motif})`,
              timestamp: mouvement.date,
              read: false,
              user_name: `${userMouvement.prenom || ''} ${userMouvement.nom || ''}`.trim() || userMouvement.email
            });
          }
        });

        console.log('Notifications créées:', newNotifications.length);
        setNotifications(newNotifications.slice(0, 10));
        setUnreadCount(newNotifications.length);
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      }
    };

    fetchData();

    // Polling pour les nouvelles notifications toutes les 30 secondes
    const interval = setInterval(fetchData, 30000);

    return () => clearInterval(interval);
  }, [user]);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    setUnreadCount(0);
  };

  // Ne pas afficher pour les employés
  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-gray-600 transition-all duration-200 hover:bg-gray-100 rounded-lg"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 transform transition-all duration-200 ease-out">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200"
                  >
                    Tout marquer comme lu
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors duration-200 ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-full bg-blue-100">
                      {notification.message.includes('Entrée') ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${
                        !notification.read ? 'text-gray-900' : 'text-gray-700'
                      }`}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      {notification.user_name && (
                        <div className="flex items-center mt-2 text-xs text-gray-500">
                          <UserIcon className="h-3 w-3 mr-1" />
                          Par {notification.user_name}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {notification.timestamp.toLocaleString('fr-FR')}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Aucune notification récente</p>
                <p className="text-xs text-gray-400 mt-1">Les mouvements de stock des dernières 24h apparaîtront ici</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};