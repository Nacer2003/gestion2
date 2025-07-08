import { apiRequest, endpoints, normalizeApiResponse } from '../config/api';

// Auth Services
export const authService = {
  login: (email: string, password: string) =>
    apiRequest(endpoints.login, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  
  logout: (refreshToken: string) =>
    apiRequest(endpoints.logout, {
      method: 'POST',
      body: JSON.stringify({ refresh: refreshToken }),
    }),
  
  getCurrentUser: () => apiRequest(endpoints.currentUser),
  
  getUsers: async () => {
    try {
      console.log('Récupération des utilisateurs...');
      const response = await apiRequest(endpoints.users);
      console.log('Utilisateurs API response:', response);
      return normalizeApiResponse(response);
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      throw error;
    }
  },
  
   // Version corrigée de la fonction createUser dans api.ts
createUser: async (userData: any) => {
  try {
    console.log('=== DÉBUT CRÉATION UTILISATEUR ===');
    console.log('Données reçues:', userData);

    // Créer FormData pour l'upload
    const formData = new FormData();
    
    // Générer un username basé sur l'email
    const username = userData.email.split('@')[0];
    console.log('Username généré:', username);
    
    // Ajouter TOUS les champs requis
    formData.append('username', username);
    formData.append('email', userData.email);
    formData.append('nom', userData.nom);
    formData.append('prenom', userData.prenom);
    formData.append('password', userData.password);
    formData.append('role', userData.role);
    
    // Ajouter le magasin si fourni
    if (userData.magasin) {
      formData.append('magasin', userData.magasin);
    }
    
    // Ajouter l'image si fournie
    if (userData.image) {
      formData.append('image', userData.image);
    }
    
    // Debug: afficher tout le contenu du FormData
    console.log('=== CONTENU FORMDATA ===');
    for (let [key, value] of formData.entries()) {
      console.log(`${key}:`, value);
    }
    
    console.log('=== ENVOI REQUÊTE ===');
    const response = await fetch(`http://localhost:8000/api/auth/users/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        // NE PAS ajouter Content-Type avec FormData, le navigateur le fait automatiquement
      },
      body: formData,
    });
    
    console.log('Status de la réponse:', response.status);
    console.log('Headers de la réponse:', response.headers);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Réponse d\'erreur brute:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: errorText };
      }
      
      console.error('Erreur détaillée création utilisateur:', errorData);
      throw new Error(JSON.stringify(errorData));
    }
    
    const result = await response.json();
    console.log('=== UTILISATEUR CRÉÉ AVEC SUCCÈS ===');
    console.log('Résultat:', result);
    return result;
    
  } catch (error) {
    console.error('=== ERREUR LORS DE LA CRÉATION ===');
    console.error('Erreur complète:', error);
    throw error;
  }
},
  updateUser: async (id: string, userData: any) => {
    try {
      const formData = new FormData();
      
      // Ajouter les champs modifiables
      if (userData.nom) formData.append('nom', userData.nom);
      if (userData.prenom) formData.append('prenom', userData.prenom);
      if (userData.role) formData.append('role', userData.role);
      if (userData.magasin) formData.append('magasin', userData.magasin);
      if (userData.image) formData.append('image', userData.image);
      
      console.log('Modification utilisateur avec données:', userData);
      
      const response = await fetch(`http://localhost:8000/api/auth/users/${id}/`, {
        method: 'PATCH', // Utiliser PATCH au lieu de PUT pour les mises à jour partielles
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Erreur détaillée modification utilisateur:', errorData);
        throw new Error(JSON.stringify(errorData));
      }
      
      return response.json();
    } catch (error) {
      console.error('Erreur lors de la modification utilisateur:', error);
      throw error;
    }
  },
  
  deleteUser: (id: string) =>
    apiRequest(`${endpoints.users}${id}/`, { method: 'DELETE' }),
};

// Products Services
export const productsService = {
  getProducts: async () => {
    try {
      console.log('Récupération des produits...');
      const response = await apiRequest(endpoints.products);
      console.log('Produits API response:', response);
      return normalizeApiResponse(response);
    } catch (error) {
      console.error('Erreur lors de la récupération des produits:', error);
      throw error;
    }
  },
  
  createProduct: (productData: any) => {
    const formData = new FormData();
    
    formData.append('nom', productData.nom);
    formData.append('reference', productData.reference);
    formData.append('categorie', productData.categorie);
    formData.append('prix_unitaire', productData.prix_unitaire.toString());
    formData.append('seuil_alerte', productData.seuil_alerte.toString());
    
    if (productData.fournisseur) {
      formData.append('fournisseur', productData.fournisseur);
    }
    
    if (productData.image) {
      formData.append('image', productData.image);
    }
    
    return fetch(`http://localhost:8000/api/products/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: formData,
    }).then(async response => {
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Erreur HTTP: ${response.status}`);
      }
      return response.json();
    });
  },
  
  updateProduct: (id: string, productData: any) => {
    const formData = new FormData();
    
    formData.append('nom', productData.nom);
    formData.append('reference', productData.reference);
    formData.append('categorie', productData.categorie);
    formData.append('prix_unitaire', productData.prix_unitaire.toString());
    formData.append('seuil_alerte', productData.seuil_alerte.toString());
    
    if (productData.fournisseur) {
      formData.append('fournisseur', productData.fournisseur);
    }
    
    if (productData.image) {
      formData.append('image', productData.image);
    }
    
    return fetch(`http://localhost:8000/api/products/${id}/`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: formData,
    }).then(async response => {
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Erreur HTTP: ${response.status}`);
      }
      return response.json();
    });
  },
  
  deleteProduct: (id: string) =>
    apiRequest(`${endpoints.products}${id}/`, { method: 'DELETE' }),
};

// Stores Services
export const storesService = {
  getStores: async () => {
    try {
      console.log('Récupération des magasins...');
      const response = await apiRequest(endpoints.stores);
      console.log('Magasins API response:', response);
      return normalizeApiResponse(response);
    } catch (error) {
      console.error('Erreur lors de la récupération des magasins:', error);
      throw error;
    }
  },
  
  createStore: (storeData: any) => {
    const formData = new FormData();
    
    formData.append('nom', storeData.nom);
    formData.append('adresse', storeData.adresse);
    formData.append('latitude', storeData.latitude.toString());
    formData.append('longitude', storeData.longitude.toString());
    
    if (storeData.image) {
      formData.append('image', storeData.image);
    }
    
    return fetch(`http://localhost:8000/api/stores/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: formData,
    }).then(async response => {
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Erreur HTTP: ${response.status}`);
      }
      return response.json();
    });
  },
  
  updateStore: (id: string, storeData: any) => {
    const formData = new FormData();
    
    formData.append('nom', storeData.nom);
    formData.append('adresse', storeData.adresse);
    formData.append('latitude', storeData.latitude.toString());
    formData.append('longitude', storeData.longitude.toString());
    
    if (storeData.image) {
      formData.append('image', storeData.image);
    }
    
    return fetch(`http://localhost:8000/api/stores/${id}/`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: formData,
    }).then(async response => {
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Erreur HTTP: ${response.status}`);
      }
      return response.json();
    });
  },
  
  deleteStore: (id: string) =>
    apiRequest(`${endpoints.stores}${id}/`, { method: 'DELETE' }),
};

// Suppliers Services
export const suppliersService = {
  getSuppliers: async () => {
    try {
      console.log('Récupération des fournisseurs...');
      const response = await apiRequest(endpoints.suppliers);
      console.log('Fournisseurs API response:', response);
      return normalizeApiResponse(response);
    } catch (error) {
      console.error('Erreur lors de la récupération des fournisseurs:', error);
      throw error;
    }
  },
  
  createSupplier: (supplierData: any) => {
    const formData = new FormData();
    
    formData.append('nom', supplierData.nom);
    formData.append('adresse', supplierData.adresse);
    formData.append('contact', supplierData.contact);
    
    if (supplierData.image) {
      formData.append('image', supplierData.image);
    }
    
    return fetch(`http://localhost:8000/api/suppliers/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: formData,
    }).then(async response => {
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Erreur HTTP: ${response.status}`);
      }
      return response.json();
    });
  },
  
  updateSupplier: (id: string, supplierData: any) => {
    const formData = new FormData();
    
    formData.append('nom', supplierData.nom);
    formData.append('adresse', supplierData.adresse);
    formData.append('contact', supplierData.contact);
    
    if (supplierData.image) {
      formData.append('image', supplierData.image);
    }
    
    return fetch(`http://localhost:8000/api/suppliers/${id}/`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: formData,
    }).then(async response => {
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Erreur HTTP: ${response.status}`);
      }
      return response.json();
    });
  },
  
  deleteSupplier: (id: string) =>
    apiRequest(`${endpoints.suppliers}${id}/`, { method: 'DELETE' }),
};

// Corrections pour stockService dans api.ts

export const stockService = {
  getStocks: async () => {
    try {
      const response = await apiRequest(endpoints.stocks);
    
      const normalizedData = normalizeApiResponse(response).map((stock: any) => ({
        ...stock,
        id: Number(stock.id),
        produit_id: Number(stock.produit_id || stock.product || stock.produit),
        magasin_id: Number(stock.magasin_id || stock.magasin || stock.store),
        quantite: Number(stock.quantite || stock.quantity),
        updatedAt: new Date(stock.updated_at || stock.updatedAt)
      }));
      
      const validStocks = normalizedData.filter(stock => 
        !isNaN(stock.produit_id) && 
        !isNaN(stock.magasin_id) && 
        !isNaN(stock.quantite) &&
        stock.produit_id > 0 &&
        stock.magasin_id > 0
      );
      
      return validStocks;
    } catch (error) {
      throw error;
    }
  },
  
  createStock: async (stockData: any) => {
    try {
      // Vérifier si le stock existe déjà
      const existingStocks = await stockService.getStocks();
      const existingStock = existingStocks.find((stock: any) => 
        Number(stock.produit_id) === Number(stockData.produit) && 
        Number(stock.magasin_id) === Number(stockData.magasin)
      );

      if (existingStock) {
        // Mettre à jour le stock existant en ajoutant la quantité
        const newQuantity = Number(existingStock.quantite) + Number(stockData.quantite);
        return await stockService.updateStock(existingStock.id, {
          produit_id: stockData.produit,
          magasin_id: stockData.magasin,
          quantite: newQuantity
        });
      } else {
        // Créer un nouveau stock
        const normalizedStockData = {
          produit: stockData.produit,
          magasin: stockData.magasin,
          quantite: stockData.quantite
        };
        
        const response = await apiRequest(endpoints.stocks, {
          method: 'POST',
          body: JSON.stringify(normalizedStockData),
        });
        
        if (!response.id) {
          throw new Error('Réponse API invalide: ID manquant');
        }
        
        return response;
      }
    } catch (error) {
      throw error;
    }
  },
  
  updateStock: async (id: string, stockData: any) => {
    try {
      const normalizedStockData = {
        produit: stockData.produit,
        magasin: stockData.magasin,
        quantite: stockData.quantite
      };
      
      const response = await apiRequest(`${endpoints.stocks}${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(normalizedStockData),
      });
      return response;
    } catch (error) {
      throw error;
    }
  },
  
  deleteStock: async (id: string) => {
    try {
      const response = await apiRequest(`${endpoints.stocks}${id}/`, { method: 'DELETE' });
      return response;
    } catch (error) {
      throw error;
    }
  },
  
  getStock: async (id: string) => {
    try {
      const response = await apiRequest(`${endpoints.stocks}${id}/`);
      return response;
    } catch (error) {
      throw error;
    }
  },
  
  checkStockExists: async (produitId: number, magasinId: number) => {
    try {
      const stocks = await stockService.getStocks();
      return stocks.find((stock: any) => 
        Number(stock.produit_id) === Number(produitId) && 
        Number(stock.magasin_id) === Number(magasinId)
      );
    } catch (error) {
      throw error;
    }
  },
  
  getMovements: async () => {
    try {
      const response = await apiRequest(endpoints.movements);
      return normalizeApiResponse(response);
    } catch (error) {
      throw error;
    }
  },
  
  createMovement: async (movementData: any) => {
    try {
      const response = await apiRequest(endpoints.movements, {
        method: 'POST',
        body: JSON.stringify(movementData),
      });
      return response;
    } catch (error) {
      throw error;
    }
  },
};
// Attendance Services
export const attendanceService = {
  getAttendance: async () => {
    try {
      console.log('=== API: Récupération des présences ===');
      const response = await apiRequest(endpoints.attendance);
      console.log('✅ Présences reçues:', response.length || 0, 'éléments');
      return normalizeApiResponse(response);
    } catch (error) {
      console.error('❌ Erreur récupération présences:', error);
      throw error;
    }
  },
  
  createAttendance: async (attendanceData: any) => {
    try {
      console.log('=== API: Création présence ===');
      console.log('Données envoyées:', attendanceData);
      
      const response = await apiRequest(endpoints.attendance, {
        method: 'POST',
        body: JSON.stringify(attendanceData),
      });
      
      console.log('✅ Présence créée via API:', response);
      return response;
    } catch (error) {
      console.error('❌ Erreur création présence API:', error);
      throw error;
    }
  },
  
  updateAttendance: async (id: string, attendanceData: any) => {
    try {
      console.log('=== API: Mise à jour présence ===');
      console.log('ID:', id);
      console.log('Données:', attendanceData);
      
      const response = await apiRequest(`${endpoints.attendance}${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(attendanceData),
      });
      
      console.log('✅ Présence mise à jour via API:', response);
      return response;
    } catch (error) {
      console.error('❌ Erreur mise à jour présence API:', error);
      throw error;
    }
  },
  
  deleteAttendance: (id: string) =>
    apiRequest(`${endpoints.attendance}${id}/`, { method: 'DELETE' }),
};

// Messaging Services
export const messagingService = {
  getMessages: async () => {
    try {
      const response = await apiRequest(endpoints.messages);
      const normalizedData = normalizeApiResponse(response);
      return normalizedData;
    } catch (error) {
      throw error;
    }
  },
  
  createMessage: async (messageData: any) => {
    try {
      const response = await apiRequest(endpoints.messages, {
        method: 'POST',
        body: JSON.stringify(messageData),
      });
      return response;
    } catch (error) {
      throw error;
    }
  },
  
  updateMessage: async (id: string, messageData: any) => {
    try {
      const response = await apiRequest(`${endpoints.messages}${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(messageData),
      });
      return response;
    } catch (error) {
      throw error;
    }
  },
  
  deleteMessage: (id: string) =>
    apiRequest(`${endpoints.messages}${id}/`, { method: 'DELETE' }),
};