import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, Filter, Download, AlertCircle, Coffee, LogOut, LogIn, FileText } from 'lucide-react';
import { attendanceService, authService, storesService } from '../../services/api';
import { normalizeApiResponse } from '../../config/api';
import { Presence, User as UserType, Magasin } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

export const PresencesPage: React.FC = () => {
  const [presences, setPresences] = useState<Presence[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedUser, setSelectedUser] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchPresences();
  }, [selectedDate, selectedUser]);

  const fetchData = async () => {
    try {
      // Récupérer les utilisateurs
      const usersData = await authService.getUsers();
      const normalizedUsers = normalizeApiResponse(usersData);
      setUsers(normalizedUsers.map((item: any) => ({
        ...item,
        createdAt: new Date(item.date_joined || item.created_at)
      })));
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      toast.error('Erreur lors du chargement des données');
    }
  };

  const fetchPresences = async () => {
    setLoading(true);
    try {
      const data = await attendanceService.getAttendance();
      const normalizedData = normalizeApiResponse(data);
      let presencesData = normalizedData.map((item: any) => ({
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

      // Filtrer par date
      if (selectedDate) {
        const filterDate = new Date(selectedDate);
        presencesData = presencesData.filter(presence => {
          const presenceDate = presence.date_pointage;
          return presenceDate.toDateString() === filterDate.toDateString();
        });
      }

      // Filtrer par utilisateur
      if (selectedUser) {
        presencesData = presencesData.filter(presence => presence.user_id === selectedUser);
      }

      setPresences(presencesData);
    } catch (error) {
      console.error('Erreur lors du chargement des présences:', error);
      toast.error('Erreur lors du chargement des présences');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Date',
      'Prénom',
      'Nom', 
      'Email',
      'Magasin',
      'Arrivée',
      'Départ',
      'Début Pause',
      'Fin Pause',
      'Durée Pause (min)',
      'Temps de Travail (h)'
    ];
    
    const csvData = presences.map(presence => {
      const user = users.find(u => u.id === presence.user_id);
      const tempsTrail = calculateWorkTime(presence);
      
      return [
        presence.date_pointage.toLocaleDateString('fr-FR'),
        user?.prenom || '',
        user?.nom || '',
        user?.email || 'Utilisateur supprimé',
        presence.magasin_nom || 'Magasin inconnu',
        presence.heure_entree?.toLocaleTimeString('fr-FR') || '',
        presence.heure_sortie?.toLocaleTimeString('fr-FR') || '',
        presence.pause_entree?.toLocaleTimeString('fr-FR') || '',
        presence.pause_sortie?.toLocaleTimeString('fr-FR') || '',
        presence.duree_pause || '',
        tempsTrail
      ];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `presences_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Export CSV généré avec succès');
  };

  const calculateWorkTime = (presence: Presence): string => {
    if (!presence.heure_entree || !presence.heure_sortie) return '';
    
    const entree = presence.heure_entree.getTime();
    const sortie = presence.heure_sortie.getTime();
    const pauseDuree = presence.duree_pause || 0;
    
    const tempsTotal = (sortie - entree) / (1000 * 60); // en minutes
    const tempsTravail = tempsTotal - pauseDuree;
    
    const heures = Math.floor(tempsTravail / 60);
    const minutes = Math.round(tempsTravail % 60);
    
    return `${heures}h${minutes.toString().padStart(2, '0')}`;
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Configuration des couleurs
    const primaryColor = [59, 130, 246]; // Bleu
    const secondaryColor = [107, 114, 128]; // Gris
    const accentColor = [16, 185, 129]; // Vert
    
    // En-tête avec logo et titre
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 35, 'F');
    
    // Titre principal
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('STOCKPRO', 20, 15);
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('RAPPORT DE PRÉSENCES', 20, 25);
    
    // Informations du rapport
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    const reportInfo = [
      `Période: ${selectedDate ? new Date(selectedDate).toLocaleDateString('fr-FR') : 'Toutes les dates'}`,
      `Employé: ${selectedUser ? users.find(u => u.id === selectedUser)?.email || 'Inconnu' : 'Tous les employés'}`,
      `Généré le: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`,
      `Nombre d'enregistrements: ${presences.length}`
    ];
    
    let yPos = 45;
    reportInfo.forEach(info => {
      doc.text(info, 20, yPos);
      yPos += 7;
    });
    
    // Ligne de séparation
    doc.setDrawColor(...secondaryColor);
    doc.setLineWidth(0.5);
    doc.line(20, yPos + 5, 190, yPos + 5);
    
    // Données du tableau
    const tableData = presences.map(presence => {
      const user = users.find(u => u.id === presence.user_id);
      const tempsTrail = calculateWorkTime(presence);
      
      return [
        presence.date_pointage.toLocaleDateString('fr-FR'),
        `${user?.prenom || ''} ${user?.nom || ''}`.trim() || 'Utilisateur supprimé',
        presence.magasin_nom || 'Magasin inconnu',
        presence.heure_entree?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || '-',
        presence.heure_sortie?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || '-',
        presence.duree_pause ? `${presence.duree_pause}min` : '-',
        tempsTrail || '-'
      ];
    });

    // Configuration du tableau avec autoTable
    autoTable(doc, {
      head: [['Date', 'Employé', 'Magasin', 'Arrivée', 'Départ', 'Pause', 'Temps Travail']],
      body: tableData,
      startY: yPos + 15,
      styles: {
        fontSize: 9,
        cellPadding: 4,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        textColor: [51, 51, 51],
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      bodyStyles: {
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' }, // Date
        1: { cellWidth: 40, halign: 'left' },   // Employé
        2: { cellWidth: 35, halign: 'left' },   // Magasin
        3: { cellWidth: 20, halign: 'center' }, // Arrivée
        4: { cellWidth: 20, halign: 'center' }, // Départ
        5: { cellWidth: 20, halign: 'center' }, // Pause
        6: { cellWidth: 25, halign: 'center' }  // Temps Travail
      },
      margin: { top: 15, left: 15, right: 15 },
      theme: 'striped',
      didDrawPage: function (data: any) {
        // Pied de page
        const pageCount = doc.internal.getNumberOfPages();
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        
        // Ligne de pied de page
        doc.setDrawColor(...secondaryColor);
        doc.setLineWidth(0.3);
        doc.line(20, pageHeight - 20, 190, pageHeight - 20);
        
        // Texte du pied de page
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...secondaryColor);
        doc.text(`Page ${data.pageNumber} sur ${pageCount}`, 105, pageHeight - 12, { align: 'center' });
        doc.text('StockPro - Système de gestion des présences', 105, pageHeight - 7, { align: 'center' });
      }
    });

    // Statistiques en bas
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    
    // Titre des statistiques
    doc.setFillColor(...accentColor);
    doc.rect(20, finalY, 170, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('RÉSUMÉ STATISTIQUE', 25, finalY + 6);
    
    // Calculs statistiques
    const employesPresents = new Set(presences.map(p => p.user_id)).size;
    const arrivees = presences.filter(p => p.heure_entree).length;
    const departs = presences.filter(p => p.heure_sortie).length;
    const pauses = presences.filter(p => p.pause_entree).length;
    const tempsTotal = presences.reduce((total, p) => {
      const temps = calculateWorkTime(p);
      if (temps) {
        const [heures, minutes] = temps.split('h');
        return total + (parseInt(heures) * 60) + parseInt(minutes || '0');
      }
      return total;
    }, 0);
    
    // Affichage des statistiques en colonnes
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const statsY = finalY + 15;
    const stats = [
      [`Employés présents: ${employesPresents}`, `Temps total travaillé: ${Math.floor(tempsTotal / 60)}h${(tempsTotal % 60).toString().padStart(2, '0')}`],
      [`Pointages d'arrivée: ${arrivees}`, `Moyenne par employé: ${employesPresents > 0 ? Math.round(tempsTotal / employesPresents) : 0} min`],
      [`Pointages de départ: ${departs}`, `Taux de présence: ${employesPresents > 0 ? Math.round((arrivees / employesPresents) * 100) : 0}%`],
      [`Pauses prises: ${pauses}`, `Efficacité: ${departs === arrivees ? '100%' : Math.round((departs / arrivees) * 100) + '%'}`]
    ];
    
    stats.forEach((row, index) => {
      const y = statsY + (index * 7);
      doc.text(`• ${row[0]}`, 25, y);
      doc.text(`• ${row[1]}`, 115, y);
    });
    
    // Encadré final
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(1);
    doc.rect(20, finalY, 170, stats.length * 7 + 20, 'S');

    // Sauvegarder le PDF
    const dateStr = selectedDate || new Date().toISOString().split('T')[0];
    const fileName = `StockPro_Presences_${dateStr.replace(/-/g, '')}.pdf`;
    doc.save(fileName);
    
    toast.success('Rapport PDF généré avec succès');
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Présences</h1>
          <p className="text-gray-600 mt-1">Consultez l'historique des pointages</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={exportToCSV}
            disabled={presences.length === 0}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-2"
          >
            <Download className="h-5 w-5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={exportToPDF}
            disabled={presences.length === 0}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-2"
          >
            <FileText className="h-5 w-5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900">Filtres</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Utilisateur
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tous les utilisateurs</option>
              {users.filter(user => user.role === 'employe').map((user) => (
                <option key={user.id} value={user.id}>
                  {user.prenom} {user.nom} ({user.email})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Presences Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          </div>
        ) : presences.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilisateur
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Temps travail
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {presences.map((presence) => {
                  const user = users.find(u => u.id === presence.user_id);
                  const tempsTrail = calculateWorkTime(presence);
                  return (
                    <tr key={presence.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                          <div className="text-sm font-medium text-gray-900">
                            {presence.date_pointage.toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8">
                            {user?.image_url ? (
                              <img
                                src={`http://localhost:8000${user.image_url}`}
                                alt={`${user.prenom} ${user.nom}`}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                <User className="h-4 w-4 text-blue-600" />
                              </div>
                            )}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {user ? `${user.prenom} ${user.nom}` : 'Utilisateur supprimé'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user?.email || 'Email inconnu'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {presence.magasin_nom || 'Magasin inconnu'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-green-600">
                          <LogIn className="h-4 w-4 mr-1" />
                          {presence.heure_entree?.toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          }) || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-red-600">
                          <LogOut className="h-4 w-4 mr-1" />
                          {presence.heure_sortie?.toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          }) || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-yellow-600">
                          <Coffee className="h-4 w-4 mr-1" />
                          {presence.pause_entree?.toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          }) || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                        {presence.duree_pause ? formatDuration(presence.duree_pause) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {tempsTrail || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune présence trouvée</h3>
            <p className="text-gray-600">
              Aucun pointage ne correspond aux filtres sélectionnés.
            </p>
          </div>
        )}
      </div>

      {/* Statistics */}
      {presences.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Statistiques du jour</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <User className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-600">Employés présents</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {new Set(presences.map(p => p.user_id)).size}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <LogIn className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-600">Arrivées</p>
                  <p className="text-2xl font-bold text-green-900">
                    {presences.filter(p => p.heure_entree).length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center">
                <LogOut className="h-8 w-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-600">Départs</p>
                  <p className="text-2xl font-bold text-red-900">
                    {presences.filter(p => p.heure_sortie).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Coffee className="h-8 w-8 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-yellow-600">Pauses</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {presences.filter(p => p.pause_entree).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};