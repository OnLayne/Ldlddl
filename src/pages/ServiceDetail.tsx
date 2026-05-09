import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { ServiceRecord, ServiceLog, Transaction, Photo } from '../types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Mic, MicOff, ClipboardCopy, Share2, User, Settings, CheckCircle2, Edit, Clock, DollarSign, Camera, PenTool, Save, Printer, Smartphone, CalendarDays, Trash2, X, Eye, Sparkles, MessageSquare } from 'lucide-react';
import { format, addYears, differenceInDays, parseISO } from 'date-fns';
import SignatureCanvas from 'react-signature-canvas';
import { PdfTemplate } from '../components/pdf/PdfTemplate';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [record, setRecord] = useState<ServiceRecord | null>(null);
  const [logs, setLogs] = useState<ServiceLog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  
  // Edit states
  const [notes, setNotes] = useState({
    status: '',
    faultDiagnosis: '',
    actionsTaken: '',
    partsUsed: '',
    repairPrice: '',
    repairEndDate: ''
  });
  
  const [sigType, setSigType] = useState<'customer' | 'technician' | null>(null);
  const sigPad = useRef<any>(null);
  const [isSigOpen, setIsSigOpen] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [isLogOpen, setIsLogOpen] = useState(false);
  const [newLog, setNewLog] = useState({ actionName: '', description: '' });

  const [isTxOpen, setIsTxOpen] = useState(false);
  const [newTx, setNewTx] = useState({ actor: '', method: 'Nakit', status: 'Tamamlandı', amount: '' });

  const [isEditDetailsOpen, setIsEditDetailsOpen] = useState(false);
  const [editDetails, setEditDetails] = useState({
    customerName: '',
    customerPhone1: '',
    customerPhone2: '',
    customerAddress: '',
    customerDistrict: '',
    customerCity: '',
    deviceBrand: '',
    deviceType: '',
    deviceModel: '',
    faultDescription: '',
    availableDate: '',
    availableTimeStart: '',
    availableTimeEnd: '',
    technicianName: '',
    warrantyYears: 0
  });

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [recordingField, setRecordingField] = useState<'faultDescription' | 'faultDiagnosis' | 'actionsTaken' | 'partsUsed' | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition && !recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'tr-TR';
      
      recognition.onend = () => {
        setRecordingField(null);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          toast.error("Ses tanıma hatası: " + event.error);
        }
        setRecordingField(null);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Update event listener when recordingField changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript && recordingField) {
          setNotes((prev: any) => ({ ...prev, [recordingField]: (prev[recordingField] || '') + finalTranscript }));
        }
      };
    }
  }, [recordingField]);

  const toggleRecording = (field: 'faultDiagnosis' | 'actionsTaken' | 'partsUsed') => {
    if (!recognitionRef.current) {
      toast.error('Tarayıcınız ses tanımayı desteklemiyor (Chrome/Safari tavsiye edilir).');
      return;
    }

    if (recordingField === field) {
      recognitionRef.current.stop();
      setRecordingField(null);
      toast.info('Ses kaydı durduruldu');
    } else {
      if (recordingField) recognitionRef.current.stop();
      setRecordingField(field);
      recognitionRef.current.start();
      toast.success('Ses kaydı başladı, konuşabilirsiniz...');
    }
  };

  useEffect(() => {
    if (!id || !user) return;
    
    // Listen to main record
    const unsubscribeRecord = onSnapshot(doc(db, 'serviceRecords', id), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as ServiceRecord;
        setRecord(data);
        setNotes({
          status: data.status || '',
          faultDiagnosis: data.faultDiagnosis || '',
          actionsTaken: data.actionsTaken || '',
          partsUsed: data.partsUsed || '',
          repairPrice: data.repairPrice?.toString() || '0',
          repairEndDate: data.repairEndDate || ''
        });
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `serviceRecords/${id}`));

    // Listen to logs
    const qLogs = query(collection(db, `serviceRecords/${id}/logs`), orderBy('createdAt', 'desc'));
    const unsubscribeLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ServiceLog[]);
    });

    // Listen to transactions
    const qTx = query(collection(db, `serviceRecords/${id}/transactions`), orderBy('createdAt', 'desc'));
    const unsubscribeTx = onSnapshot(qTx, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Transaction[]);
    });

    // Listen to photos
    const qPhotos = query(collection(db, `serviceRecords/${id}/photos`), orderBy('createdAt', 'desc'));
    const unsubscribePhotos = onSnapshot(qPhotos, (snap) => {
      setPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Photo[]);
    });

    return () => {
      unsubscribeRecord();
      unsubscribeLogs();
      unsubscribeTx();
      unsubscribePhotos();
    };
  }, [id, user]);

  const handleStatusChange = async (newStatus: string) => {
    if (!id || !user) return;
    setNotes(prev => ({ ...prev, status: newStatus }));
    try {
      await updateDoc(doc(db, 'serviceRecords', id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      toast.success('Durum güncellendi');
    } catch (e) {
      toast.error('Durum güncellenemedi');
    }
  };

  const handleSaveNotes = async () => {
    if (!id || !user) return;
    try {
      await updateDoc(doc(db, 'serviceRecords', id), {
        status: notes.status,
        faultDiagnosis: notes.faultDiagnosis,
        actionsTaken: notes.actionsTaken,
        partsUsed: notes.partsUsed,
        repairPrice: Number(notes.repairPrice) || 0,
        repairEndDate: notes.repairEndDate,
        updatedAt: new Date().toISOString()
      });
      toast.success('Notlar kaydedildi');
    } catch (e) {
      toast.error('Kaydedilemedi');
    }
  };

  const handleSaveSignature = async () => {
    if (!id || !sigType || !sigPad.current) return;
    if (sigPad.current.isEmpty()) {
      toast.error('Lütfen imza alanını doldurun');
      return;
    }
    try {
      const dataURL = sigPad.current.getTrimmedCanvas().toDataURL('image/png');
      await updateDoc(doc(db, 'serviceRecords', id), {
        [sigType === 'customer' ? 'customerSignature' : 'technicianSignature']: dataURL,
        updatedAt: new Date().toISOString()
      });
      toast.success('İmza kaydedildi');
      setIsSigOpen(false);
    } catch (e) {
      toast.error('İmza kaydedilemedi');
    }
  };

  const handleGeneratePdfBlob = async (): Promise<Blob | null> => {
    if (!pdfRef.current) return null;
    setIsGeneratingPdf(true);
    const loadingToast = toast.loading('PDF oluşturuluyor, lütfen bekleyin...');
    try {
      const element = pdfRef.current;
      if (!element) throw new Error('PDF referansı bulunamadı');

      // Ensure images are loaded
      const images = element.getElementsByTagName('img');
      const imagePromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      await Promise.all(imagePromises);
      await new Promise(r => setTimeout(r, 600)); 

      const dataUrl = await toPng(element, { 
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 794,
        skipFonts: true,
        style: {
          opacity: '1',
          visibility: 'visible',
          display: 'block'
        }
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; 
      const pageHeight = 297;
      const img = new Image();
      img.src = dataUrl;
      await new Promise(resolve => img.onload = resolve);
      
      const imgHeight = (img.height * imgWidth) / img.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }
      
      toast.dismiss(loadingToast);
      return pdf.output('blob');
    } catch (e) {
      console.error('PDF Generation Error:', e);
      toast.dismiss(loadingToast);
      toast.error('PDF oluşturulamadı: ' + (e instanceof Error ? e.message : 'Bilinmeyen hata'));
      return null;
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadPdf = async () => {
    const blob = await handleGeneratePdfBlob();
    if (!blob || !record) return;
    
    const customer = record.customerName.trim().replace(/\s+/g, '_');
    const brand = record.deviceBrand.trim().replace(/\s+/g, '_');
    const fileName = `${customer}_${brand}_TeknikServisFormu_#${record.serviceId}.pdf`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('PDF İndirildi');
  };

  const handleSharePdf = async () => {
    const blob = await handleGeneratePdfBlob();
    if (!blob || !record) return;
    
    const customer = record.customerName.trim().replace(/\s+/g, '_');
    const brand = record.deviceBrand.trim().replace(/\s+/g, '_');
    const fileName = `${customer}_${brand}_TeknikServisFormu_#${record.serviceId}.pdf`;

    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Servis Formu #${record.serviceId}`,
          text: 'Servis formu ektedir.'
        });
        toast.success('Paylaşım menüsü açıldı');
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('Share cancelled by user');
        } else {
          console.error('Share failed:', error);
          toast.error('Paylaşım sırasında bir hata oluştu');
        }
      }
    } else {
      toast.error('Cihazınız doğrudan dosya paylaşımını desteklemiyor. PDF indiriliyor..');
      handleDownloadPdf();
    }
  };

  const handleReminder = () => {
    if (!record?.customerPhone1) {
      toast.error('Müşteri telefonu hatalı');
      return;
    }
    const cleanPhone = record.customerPhone1.replace(/\D/g, '');
    const text = `Sayın ${record.customerName}, #${record.serviceId} numaralı servis kaydınız için planlanan servis saati yaklaşmaktadır. Müsaitlik durumunuzu teyit ederiz.`;
    window.open(`https://wa.me/90${cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleSendSignLink = () => {
    if (!record?.customerPhone1 || !id) {
      toast.error('Müşteri telefonu eksik');
      return;
    }
    const signUrl = `${window.location.origin}/sign/${id}`;
    
    // Copy to clipboard first
    navigator.clipboard.writeText(signUrl).then(() => {
      toast.success('Onay linki kopyalandı');
    });

    const cleanPhone = record.customerPhone1.replace(/\D/g, '');
    const text = `Sayın ${record.customerName}, #${record.serviceId} numaralı servis kaydınız tamamlanmıştır. Lütfen aşağıdaki linkten servis detaylarını kontrol edip onaylayınız:\n\n${signUrl}`;
    window.open(`https://wa.me/90${cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleAddLog = async () => {
    if (!id || !user || !newLog.actionName) return;
    try {
      await addDoc(collection(db, `serviceRecords/${id}/logs`), {
        ...newLog,
        createdAt: new Date().toISOString()
      });
      toast.success('İşlem eklendi');
      setIsLogOpen(false);
      setNewLog({ actionName: '', description: '' });
    } catch(e) { handleFirestoreError(e, OperationType.CREATE, `serviceRecords/${id}/logs`); }
  };

  const handleAddTx = async () => {
    if (!id || !user || !newTx.amount) return;
    try {
      await addDoc(collection(db, `serviceRecords/${id}/transactions`), {
        ...newTx,
        amount: Number(newTx.amount),
        createdAt: new Date().toISOString()
      });
      toast.success('Hareket eklendi');
      setIsTxOpen(false);
      setNewTx({ actor: '', method: 'Nakit', status: 'Tamamlandı', amount: '' });
    } catch(e) { handleFirestoreError(e, OperationType.CREATE, `serviceRecords/${id}/transactions`); }
  };

  const handleUpdateDetails = async () => {
    if (!id || !user) return;
    try {
      await updateDoc(doc(db, 'serviceRecords', id), {
        ...editDetails,
        warrantyYears: Number(editDetails.warrantyYears) || 0,
        updatedAt: new Date().toISOString()
      });
      toast.success('Bilgiler güncellendi');
      setIsEditDetailsOpen(false);
    } catch (e) {
      toast.error('GÜncelleme hatası');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'serviceRecords', id));
      toast.success('Kayıt silindi');
      navigate('/');
    } catch(e) { handleFirestoreError(e, OperationType.DELETE, `serviceRecords/${id}`); }
  };

  const handleAiDiagnosis = async () => {
    if (!record?.faultDescription) {
      toast.error('Önce bir arıza açıklaması girilmelidir.');
      return;
    }
    
    setIsAiLoading(true);
    setAiSuggestion(null);
    try {
      const response = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceType: record.deviceType,
          brand: record.deviceBrand,
          model: record.deviceModel,
          faultDescription: record.faultDescription
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'AI analizi başarısız oldu');
      }

      const data = await response.json();
      setAiSuggestion(data.suggestion || 'Öneri oluşturulamadı.');
    } catch (error) {
      console.error('AI Error:', error);
      toast.error('Yapay zeka asistanı şu an yanıt veremiyor.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleWhatsAppDirect = () => {
    if (!record?.customerPhone1) {
      toast.error('Müşteri telefonu eksik');
      return;
    }
    const cleanPhone = record.customerPhone1.replace(/\D/g, '');
    const text = `Merhaba ${record.customerName}, #${record.serviceId} nolu servis kaydınızın detaylarını buradan takip edebilirsiniz: ${window.location.origin}/sign/${id}`;
    window.open(`https://wa.me/90${cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // compress heavily to fit in firestore
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6); 
        try {
          await addDoc(collection(db, `serviceRecords/${id}/photos`), {
            url: dataUrl,
            createdAt: new Date().toISOString()
          });
          toast.success('Fotoğraf eklendi');
        } catch (err) {
          toast.error('Boyut çok büyük veya hata oluştu');
          console.error(err);
        }
      };
      if (typeof ev.target?.result === 'string') {
        img.src = ev.target.result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!record) return <div className="p-4 text-center mt-10">Yükleniyor...</div>;

  const calculateWarrantyInfo = (createdAt: string, years: number) => {
    if (!years || years <= 0) return 'Garantisi Yok veya Bitti';
    const startDate = parseISO(createdAt);
    const endDate = addYears(startDate, years);
    const today = new Date();
    // Reset time to start of day for accurate day difference
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endDateStart = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    const diffDays = differenceInDays(endDateStart, todayStart);
    
    if (diffDays < 0) return 'Garantisi Bitti';
    return `${format(endDate, 'd.MM.yyyy')} (${diffDays} gün kaldı)`;
  };

  const totalTx = transactions.reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="space-y-6 pb-24">
      {/* Top Cards: Customer / Device stacked on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Customer Panel */}
        <div className="border border-border bg-card rounded-xl overflow-hidden">
          <div className="bg-primary/10 px-4 py-2 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <span className="font-bold tracking-wider text-sm text-foreground">MÜŞTERİ</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => {
                if (record) {
                  setEditDetails({
                    customerName: record.customerName || '',
                    customerPhone1: record.customerPhone1 || '',
                    customerPhone2: record.customerPhone2 || '',
                    customerAddress: record.customerAddress || '',
                    customerDistrict: record.customerDistrict || '',
                    customerCity: record.customerCity || '',
                    deviceBrand: record.deviceBrand || '',
                    deviceType: record.deviceType || '',
                    deviceModel: record.deviceModel || '',
                    faultDescription: record.faultDescription || '',
                    availableDate: record.availableDate || '',
                    availableTimeStart: record.availableTimeStart || '',
                    availableTimeEnd: record.availableTimeEnd || '',
                    technicianName: record.technicianName || '',
                    warrantyYears: record.warrantyYears || 0
                  });
                  setIsEditDetailsOpen(true);
                }
              }}
            >
              <Edit className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase">Ad Soyad</Label>
              <div className="font-medium text-foreground">{record.customerName}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase">Telefon</Label>
              <div className="font-medium flex items-center gap-2">
                <a href={`tel:${record.customerPhone1.replace(/\D/g, '')}`} className="text-primary hover:underline">{record.customerPhone1}</a>
                {record.customerPhone2 && (
                  <>
                    <span>/</span>
                    <a href={`tel:${record.customerPhone2.replace(/\D/g, '')}`} className="text-primary hover:underline">{record.customerPhone2}</a>
                  </>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase">Adres</Label>
              <a 
                href={`https://maps.google.com/?q=${encodeURIComponent(`${record.customerAddress}, ${record.customerDistrict}, ${record.customerCity}`)}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline text-sm block"
              >
                {record.customerAddress}, {record.customerDistrict} / {record.customerCity}
              </a>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase">Müsait Zaman</Label>
              <div className="font-medium text-foreground text-sm">{record.availableDate} {record.availableTimeStart} - {record.availableTimeEnd}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase">Teknisyen</Label>
              <div className="font-medium text-primary">{record.technicianName || '-'}</div>
            </div>
          </div>
        </div>

        {/* Device Panel */}
        <div className="border border-border bg-card rounded-xl overflow-hidden">
          <div className="bg-red-500/10 px-4 py-2 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-red-500" />
              <span className="font-bold tracking-wider text-sm text-foreground">CİHAZ</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-muted-foreground hover:text-red-500"
              onClick={() => {
                if (record) {
                  setEditDetails({
                    customerName: record.customerName || '',
                    customerPhone1: record.customerPhone1 || '',
                    customerPhone2: record.customerPhone2 || '',
                    customerAddress: record.customerAddress || '',
                    customerDistrict: record.customerDistrict || '',
                    customerCity: record.customerCity || '',
                    deviceBrand: record.deviceBrand || '',
                    deviceType: record.deviceType || '',
                    deviceModel: record.deviceModel || '',
                    faultDescription: record.faultDescription || '',
                    availableDate: record.availableDate || '',
                    availableTimeStart: record.availableTimeStart || '',
                    availableTimeEnd: record.availableTimeEnd || '',
                    technicianName: record.technicianName || '',
                    warrantyYears: record.warrantyYears || 0
                  });
                  setIsEditDetailsOpen(true);
                }
              }}
            >
              <Edit className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Marka</Label>
                <div className="font-medium text-foreground">{record.deviceBrand}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Tür</Label>
                <div className="font-medium text-foreground">{record.deviceType}</div>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase">Model</Label>
              <div className="font-medium text-foreground">{record.deviceModel || '-'}</div>
            </div>
            <div>
              <Label className="text-xs text-red-400 uppercase">Arıza</Label>
              <div className="font-medium text-red-400">{record.faultDescription}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase">Garanti Bitiş</Label>
              <div className="font-medium text-green-400">
                {calculateWarrantyInfo(record.createdAt, record.warrantyYears)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Service Status Row */}
      <div className="flex items-center gap-2 border border-border bg-card rounded-xl p-3">
        <CheckCircle2 className="w-5 h-5 text-orange-500" />
        <span className="text-sm font-bold text-muted-foreground uppercase mr-auto tracking-wider">Servis Durumu</span>
        
        <Select value={notes.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px] h-9 border-green-500/50 text-green-400 bg-green-500/5 hover:bg-green-500/10 rounded-full">
            <SelectValue placeholder="Durum seç" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Teknisyen Yönlendirildi">Teknisyen Yönlendirildi</SelectItem>
            <SelectItem value="Yerinde Bakım Yapıldı">Yerinde Bakım Yapıldı</SelectItem>
            <SelectItem value="Parçası Atölyeye Alındı">Parçası Atölyeye Alındı</SelectItem>
            <SelectItem value="Tamamlandı">Tamamlandı</SelectItem>
            <SelectItem value="İptal Edildi">İptal Edildi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* AI Assistant */}
      <div className="border border-border bg-card rounded-xl overflow-hidden">
        <div className="bg-blue-500/10 px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-bold tracking-wider text-foreground uppercase">AI ONARIM ASİSTANI</span>
          </div>
          <Button 
            disabled={isAiLoading} 
            onClick={handleAiDiagnosis} 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs bg-blue-500/5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
          >
            {isAiLoading ? 'Analiz Ediliyor...' : 'Akıllı Tanı Öner'}
          </Button>
        </div>
        <div className="p-4">
          {!aiSuggestion && !isAiLoading && (
            <p className="text-xs text-muted-foreground italic text-center py-2">
              Arıza açıklamasına göre olası çözüm adımlarını yapay zeka ile analiz etmek için yukarıdaki butona tıklayın.
            </p>
          )}
          {isAiLoading && (
            <div className="flex flex-col items-center justify-center py-4 space-y-2">
              <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-[10px] text-blue-400 font-medium animate-pulse">Gemini ile analiz yapılıyor...</p>
            </div>
          )}
          {aiSuggestion && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-2">
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">AI Önerileri</div>
              <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {aiSuggestion}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-full text-[10px] text-blue-400 hover:bg-blue-500/10 border border-blue-500/10"
                onClick={() => {
                  setNotes(prev => ({ ...prev, faultDiagnosis: (prev.faultDiagnosis ? prev.faultDiagnosis + '\n\n' : '') + 'AI Önerisi:\n' + aiSuggestion }));
                  toast.success('Öneri arıza tespiti alanına eklendi');
                }}
              >
                Notlara Ekle
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Technician Notes */}
      <div className="border border-border bg-card rounded-xl overflow-hidden">
        <div className="bg-primary/5 px-4 py-3 border-b border-border flex items-center gap-2">
          <Edit className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold tracking-wider text-foreground">TEKNİSYEN NOTLARI</span>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase">Arıza Tespiti</Label>
              <button 
                onClick={() => toggleRecording('faultDiagnosis')} 
                className={`p-1.5 rounded-full outline-none transition-colors border ${recordingField === 'faultDiagnosis' ? 'bg-red-500 text-white border-red-500 animate-pulse shadow-md shadow-red-500/20' : 'bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                title="Sesle yazdır"
              >
                {recordingField === 'faultDiagnosis' ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            <Textarea 
              value={notes.faultDiagnosis} 
              onChange={e => setNotes({...notes, faultDiagnosis: e.target.value})} 
              placeholder="Teknisyen arıza tespiti..." 
              className="bg-background border-border min-h-20"
              onBlur={handleSaveNotes}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase">Yapılan İşlemler</Label>
              <button 
                onClick={() => toggleRecording('actionsTaken')} 
                className={`p-1.5 rounded-full outline-none transition-colors border ${recordingField === 'actionsTaken' ? 'bg-red-500 text-white border-red-500 animate-pulse shadow-md shadow-red-500/20' : 'bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                title="Sesle yazdır"
              >
                {recordingField === 'actionsTaken' ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            <Textarea 
              value={notes.actionsTaken} 
              onChange={e => setNotes({...notes, actionsTaken: e.target.value})} 
              placeholder="Yapılan bakım, onarım, değişim..." 
              className="bg-background border-border min-h-20"
              onBlur={handleSaveNotes}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase">Kullanılan Parça</Label>
              <button 
                onClick={() => toggleRecording('partsUsed')} 
                className={`p-1.5 rounded-full outline-none transition-colors border ${recordingField === 'partsUsed' ? 'bg-red-500 text-white border-red-500 animate-pulse shadow-md shadow-red-500/20' : 'bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                title="Sesle yazdır"
              >
                {recordingField === 'partsUsed' ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            <Textarea 
              value={notes.partsUsed} 
              onChange={e => setNotes({...notes, partsUsed: e.target.value})} 
              placeholder="Kullanılan yedek parça listesi..." 
              className="bg-background border-border min-h-20"
              onBlur={handleSaveNotes}
            />
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase">Tamir Fiyatı (₺)</Label>
            <Input 
              type="number" 
              value={notes.repairPrice} 
              onChange={e => setNotes({...notes, repairPrice: e.target.value})} 
              className="bg-background border-border text-lg font-bold text-foreground h-12"
              onBlur={handleSaveNotes}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase">Tamir Bitiş Tarihi</Label>
            <Input 
              type="date" 
              value={notes.repairEndDate} 
              onChange={e => setNotes({...notes, repairEndDate: e.target.value})} 
              className="bg-background border-border h-12 text-center"
              onBlur={handleSaveNotes}
            />
          </div>
        </div>
      </div>

      {/* Service Logs */}
      <div className="border border-border bg-card rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-bold tracking-wider text-foreground">SERVİS GÜNLÜĞÜ</span>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs border-primary/50 text-primary hover:bg-primary/10" onClick={() => setIsLogOpen(true)}>
            + İşlem Ekle
          </Button>
        </div>
        <div className="p-0">
          <div className="grid grid-cols-12 text-[10px] text-muted-foreground uppercase px-4 py-2 border-b border-border/50 bg-background/50 font-bold">
            <div className="col-span-3">Tarih / Saat</div>
            <div className="col-span-3">İşlem Adı</div>
            <div className="col-span-6">Açıklama</div>
          </div>
          {logs.map(log => (
            <div key={log.id} className="grid grid-cols-12 text-xs border-b border-border/50 px-4 py-3 last:border-0 hover:bg-white/[0.02]">
              <div className="col-span-3 text-muted-foreground">{format(new Date(log.createdAt), 'dd.MM.yyyy HH:mm')}</div>
              <div className="col-span-3 text-primary font-medium">{log.actionName}</div>
              <div className="col-span-6 text-foreground break-words flex justify-between items-start gap-1">
                <span>{log.description}</span>
                <X onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, `serviceRecords/${id}/logs`, log.id)); }} className="w-3 h-3 text-red-500 opacity-50 hover:opacity-100 cursor-pointer flex-shrink-0 mt-0.5"/>
              </div>
            </div>
          ))}
          {logs.length === 0 && <div className="text-center text-xs text-muted-foreground py-4">Kayıt yok.</div>}
        </div>
      </div>

      {/* Financial Transactions */}
      <div className="border border-border bg-card rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-sm font-bold tracking-wider text-foreground">PARA HAREKETLERİ</span>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs border-green-500/50 text-green-400 hover:bg-green-500/10" onClick={() => setIsTxOpen(true)}>
            + Ekle
          </Button>
        </div>
        <div className="p-0">
          <div className="grid grid-cols-12 text-[10px] text-muted-foreground uppercase px-4 py-2 border-b border-border/50 bg-background/50 font-bold">
            <div className="col-span-2">Tarih</div>
            <div className="col-span-3">Yapan</div>
            <div className="col-span-2 text-center">Şekil</div>
            <div className="col-span-2 text-center">Durum</div>
            <div className="col-span-3 text-right">Tutar</div>
          </div>
          {transactions.map(tx => (
            <div key={tx.id} className="grid grid-cols-12 text-xs border-b border-border/50 px-4 py-3 last:border-0 items-center hover:bg-white/[0.02]">
              <div className="col-span-2 text-muted-foreground">{format(new Date(tx.createdAt), 'dd.MM.yyyy')}</div>
              <div className="col-span-3 text-foreground truncate">{tx.actor}</div>
              <div className="col-span-2 text-center">{tx.method}</div>
              <div className="col-span-2 text-center text-green-400">{tx.status}</div>
              <div className="col-span-3 text-right font-bold text-primary flex justify-end items-center gap-1">
                {tx.amount} ₺ <X onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, `serviceRecords/${id}/transactions`, tx.id)); }} className="w-3 h-3 text-red-500 ml-1 opacity-50 hover:opacity-100 cursor-pointer"/>
              </div>
            </div>
          ))}
          <div className="px-4 py-3 flex justify-between bg-background/30 font-bold border-t border-border">
            <span>Toplam Tahsilat</span>
            <span className="text-primary text-lg">{totalTx} ₺</span>
          </div>
        </div>
      </div>

      {/* Photos */}
      <div className="border border-border bg-card rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-bold tracking-wider text-foreground">FOTOĞRAFLAR</span>
          </div>
          <div className="relative">
            <Button variant="outline" size="sm" className="h-7 text-xs border-orange-500/50 text-orange-400 hover:bg-orange-500/10" onClick={() => document.getElementById('photoUploadInput')?.click()}>
              <Camera className="w-3 h-3 mr-1" /> Ekle
            </Button>
            <input type="file" id="photoUploadInput" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
        </div>
        <div className="p-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
          {photos.map(p => (
            <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-border group bg-background">
              <img src={p.url} alt="Servis foto" className="object-cover w-full h-full" />
              <button onClick={() => deleteDoc(doc(db, `serviceRecords/${id}/photos`, p.id))} className="absolute top-1 right-1 bg-red-500/80 p-1 rounded-full text-white cursor-pointer hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {photos.length === 0 && <div className="col-span-full text-center text-xs text-muted-foreground py-2">0 fotoğraf</div>}
          {photos.length > 0 && <div className="col-span-full text-center text-xs text-muted-foreground pt-2">{photos.length} fotoğraf</div>}
        </div>
      </div>

      {/* Signatures */}
      <div className="border border-border bg-card rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <PenTool className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold tracking-wider text-foreground">İMZA</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground uppercase text-center block tracking-wider">MÜŞTERİ İMZASI</Label>
              <div 
                onClick={() => { setSigType('customer'); setIsSigOpen(true); }}
                className={`h-24 border-2 rounded-xl flex items-center justify-center cursor-pointer transition-colors bg-background ${record.customerSignature ? 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'border-dashed border-border hover:border-primary/50'}`}
              >
                {record.customerSignature ? (
                  <img src={record.customerSignature} className="max-h-full invert" alt="Customer Sig" />
                ) : (
                  <span className="text-xs text-muted-foreground">İmza Yok</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground uppercase text-center block tracking-wider">TEKNİSYEN İMZASI</Label>
              <div 
                onClick={() => { setSigType('technician'); setIsSigOpen(true); }}
                className={`h-24 border-2 rounded-xl flex items-center justify-center cursor-pointer transition-colors bg-background ${record.technicianSignature ? 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'border-dashed border-border hover:border-primary/50'}`}
              >
                {record.technicianSignature ? (
                  <img src={record.technicianSignature} className="max-h-full invert" alt="Technician Sig" />
                ) : (
                  <span className="text-xs text-muted-foreground">İmza Yok</span>
                )}
              </div>
            </div>

          </div>
          <div className="text-center text-[10px] text-muted-foreground mt-4 italic">
            ✓ Müşteri teslim aldığını imzalayarak onayladı
          </div>
        </div>
      </div>

      <Dialog open={isSigOpen} onOpenChange={setIsSigOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PenTool className="w-5 h-5 text-primary"/> {sigType === 'customer' ? 'Müşteri İmzas' : 'Teknisyen İmzası'}</DialogTitle>
          </DialogHeader>
          <div className="bg-white rounded-xl overflow-hidden border border-border mt-4">
            <SignatureCanvas 
              ref={sigPad}
              penColor="blue"
              canvasProps={{className: "sigCanvas w-full h-48"}}
            />
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="w-1/3 bg-background border-border" onClick={() => sigPad.current?.clear()}>Temizle</Button>
            <Button className="w-2/3 bg-primary text-black font-semibold" onClick={handleSaveSignature}>İmzayı Kaydet ✓</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Dialogs */}
      <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni İşlem Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>İşlem Adı <span className="text-red-500">*</span></Label>
              <Input value={newLog.actionName} onChange={e => setNewLog({...newLog, actionName: e.target.value})} className="bg-background" placeholder="Örn: Parça Geldi" />
            </div>
            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Textarea value={newLog.description} onChange={e => setNewLog({...newLog, description: e.target.value})} className="bg-background" placeholder="Detay..." />
            </div>
            <Button className="w-full bg-primary text-black" onClick={handleAddLog}>Ekle</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isTxOpen} onOpenChange={setIsTxOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Tahsilat Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tutar (₺) <span className="text-red-500">*</span></Label>
              <Input type="number" value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label>Ödeme Şekli</Label>
              <Select value={newTx.method} onValueChange={v => setNewTx({...newTx, method: v })}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nakit">Nakit</SelectItem>
                  <SelectItem value="Kredi Kartı">Kredi Kartı</SelectItem>
                  <SelectItem value="Havale/EFT">Havale/EFT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tahsil Eden</Label>
              <Input value={newTx.actor} onChange={e => setNewTx({...newTx, actor: e.target.value})} className="bg-background" placeholder="İsim..." />
            </div>
            <Button className="w-full bg-primary text-black" onClick={handleAddTx}>Ekle</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDetailsOpen} onOpenChange={setIsEditDetailsOpen}>
        <DialogContent className="bg-card border-border sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bilgileri Düzenle</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-primary flex items-center gap-2">
                <User className="w-4 h-4" /> Müşteri Bilgileri
              </h3>
              <div className="space-y-2">
                <Label>Ad Soyad</Label>
                <Input value={editDetails.customerName} onChange={e => setEditDetails({...editDetails, customerName: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Telefon 1</Label>
                <Input value={editDetails.customerPhone1} onChange={e => setEditDetails({...editDetails, customerPhone1: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Telefon 2</Label>
                <Input value={editDetails.customerPhone2} onChange={e => setEditDetails({...editDetails, customerPhone2: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Adres</Label>
                <Textarea value={editDetails.customerAddress} onChange={e => setEditDetails({...editDetails, customerAddress: e.target.value})} className="bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>İlçe</Label>
                  <Input value={editDetails.customerDistrict} onChange={e => setEditDetails({...editDetails, customerDistrict: e.target.value})} className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Şehir</Label>
                  <Input value={editDetails.customerCity} onChange={e => setEditDetails({...editDetails, customerCity: e.target.value})} className="bg-background" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-sm text-red-500 flex items-center gap-2">
                <Settings className="w-4 h-4" /> Cihaz & Servis
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Marka</Label>
                  <Input value={editDetails.deviceBrand} onChange={e => setEditDetails({...editDetails, deviceBrand: e.target.value})} className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Tür</Label>
                  <Input value={editDetails.deviceType} onChange={e => setEditDetails({...editDetails, deviceType: e.target.value})} className="bg-background" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Model No</Label>
                <Input value={editDetails.deviceModel} onChange={e => setEditDetails({...editDetails, deviceModel: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Arıza Açıklaması</Label>
                <Textarea value={editDetails.faultDescription} onChange={e => setEditDetails({...editDetails, faultDescription: e.target.value})} className="bg-background text-red-400" />
              </div>
              <div className="space-y-2">
                <Label>Garanti Süresi (Yıl)</Label>
                <Input type="number" value={editDetails.warrantyYears} onChange={e => setEditDetails({...editDetails, warrantyYears: Number(e.target.value)})} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Sorumlu Teknisyen</Label>
                <Input value={editDetails.technicianName} onChange={e => setEditDetails({...editDetails, technicianName: e.target.value})} className="bg-background" />
              </div>
            </div>

            <div className="col-span-full space-y-4 border-t pt-4">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <CalendarDays className="w-4 h-4" /> Randevu Zamanı
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label>Tarih</Label>
                  <Input type="date" value={editDetails.availableDate} onChange={e => setEditDetails({...editDetails, availableDate: e.target.value})} className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Başlangıç</Label>
                  <Input type="time" value={editDetails.availableTimeStart} onChange={e => setEditDetails({...editDetails, availableTimeStart: e.target.value})} className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Bitiş</Label>
                  <Input type="time" value={editDetails.availableTimeEnd} onChange={e => setEditDetails({...editDetails, availableTimeEnd: e.target.value})} className="bg-background" />
                </div>
              </div>
            </div>
          </div>
          <Button className="w-full bg-primary text-black font-bold h-12 mt-6" onClick={handleUpdateDetails}>
            <Save className="w-4 h-4 mr-2" /> Değişiklikleri Kaydet
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="bg-card border-border sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-400" /> Servis Formu Önizleme
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center bg-muted/30 p-2 sm:p-6">
            <div className="bg-white shadow-2xl rounded-sm origin-top scale-[0.45] sm:scale-100 h-fit">
              {record && (
                <PdfTemplate 
                  record={record} 
                  logs={logs} 
                  transactions={transactions} 
                />
              )}
            </div>
          </div>
          <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t p-4 flex gap-3">
             <Button variant="outline" className="flex-1" onClick={() => setIsPreviewOpen(false)}>Kapat</Button>
             <Button className="flex-1 bg-primary text-black font-bold" onClick={() => { setIsPreviewOpen(false); handleDownloadPdf(); }}>
               <Printer className="w-4 h-4 mr-2" /> PDF Olarak İndir
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kayıt Silinecek</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">Bu servis kaydını tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="w-1/2" onClick={() => setIsDeleteOpen(false)}>İptal</Button>
              <Button variant="destructive" className="w-1/2" onClick={handleDelete}>Sil</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden PDF container - stabilized for capture */}
      <div 
        style={{ 
          position: 'absolute', 
          left: '-9999px', 
          top: '0', 
          width: '794px',
          visibility: 'visible',
          opacity: 1,
          pointerEvents: 'none',
          zIndex: -9999
        }} 
        aria-hidden="true"
      >
         {record && <PdfTemplate ref={pdfRef} record={record} logs={logs} transactions={transactions} />}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-2 bg-background/95 backdrop-blur border-t border-border flex justify-between gap-1 sm:gap-2 max-w-2xl mx-auto z-20 overflow-x-auto pb-safe">
        <Button onClick={handleSaveNotes} className="flex-1 min-w-[70px] h-12 bg-primary text-black flex flex-col items-center justify-center gap-1 rounded-xl">
          <Save className="w-4 h-4" /> <span className="text-[10px] font-bold">Kaydet</span>
        </Button>
        <Button onClick={handleWhatsAppDirect} variant="outline" className="flex-1 min-w-[70px] h-12 bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20 flex flex-col items-center justify-center gap-1 rounded-xl">
          <MessageSquare className="w-4 h-4" /> <span className="text-[10px] font-bold">WhatsApp</span>
        </Button>
        <Button onClick={() => setIsPreviewOpen(true)} variant="outline" className="flex-1 min-w-[70px] h-12 bg-card border-blue-500/20 text-blue-400 hover:bg-blue-500/10 flex flex-col items-center justify-center gap-1 rounded-xl">
          <Eye className="w-4 h-4" /> <span className="text-[10px] font-bold">Önizle</span>
        </Button>
        <Button onClick={handleDownloadPdf} disabled={isGeneratingPdf} variant="outline" className="flex-1 min-w-[70px] h-12 bg-card border-primary/20 text-primary hover:bg-primary/10 flex flex-col items-center justify-center gap-1 rounded-xl">
          <Printer className="w-4 h-4" /> <span className="text-[10px] font-bold">PDF İndir</span>
        </Button>
        <Button onClick={handleSharePdf} disabled={isGeneratingPdf} variant="outline" className="flex-1 min-w-[70px] h-12 bg-card border-green-500/20 text-green-400 hover:bg-green-500/10 flex flex-col items-center justify-center gap-1 rounded-xl">
          <Smartphone className="w-4 h-4" /> <span className="text-[10px] font-bold text-center leading-none">WA PDF</span>
        </Button>
        <Button onClick={handleSendSignLink} variant="outline" className="flex-1 min-w-[70px] h-12 bg-card border-green-500/20 text-green-400 hover:bg-green-500/10 flex flex-col items-center justify-center gap-1 rounded-xl">
          <Share2 className="w-4 h-4" /> <span className="text-[10px] font-bold text-center leading-none">WA İmza<br/>Link</span>
        </Button>
        <Button onClick={() => setIsLogOpen(true)} variant="outline" className="flex-1 min-w-[70px] h-12 bg-card border-purple-500/20 text-purple-400 hover:bg-purple-500/10 flex flex-col items-center justify-center gap-1 rounded-xl">
          <Settings className="w-4 h-4" /> <span className="text-[10px] font-bold">İşlem+</span>
        </Button>
        <Button onClick={() => setIsDeleteOpen(true)} variant="outline" className="flex-1 min-w-[70px] h-12 bg-card border-red-500/20 text-red-500 hover:bg-red-500/10 flex flex-col items-center justify-center gap-1 rounded-xl">
          <Trash2 className="w-4 h-4" /> <span className="text-[10px] font-bold">Sil</span>
        </Button>
      </div>

    </div>
  );
}
