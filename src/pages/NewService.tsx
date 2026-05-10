import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { User, MonitorSmartphone, StickyNote, Scan, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { GoogleGenAI, Type } from "@google/genai";

export function NewService() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Basic state for the form instead of complex react-hook-form since we just need simple inputs
  const [formData, setFormData] = useState({
    customerType: 'Bireysel',
    customerName: '',
    customerPhone1: '',
    customerPhone2: '',
    customerCity: '',
    customerDistrict: '',
    customerAddress: '',
    customerTaxNo: '',
    availableDate: format(new Date(), 'yyyy-MM-dd'),
    availableTimeStart: '09:00',
    availableTimeEnd: '18:00',
    deviceBrand: '',
    deviceType: '',
    deviceModel: '',
    deviceSerialNo: '',
    faultDescription: '',
    warrantyYears: '1',
    technicianName: '',
    operatorNote: ''
  });

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    let finalValue = value;
    
    // Auto capitalize names and brands
    if (name === 'customerName' || name === 'deviceBrand' || name === 'technicianName') {
      finalValue = value.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanLoading(true);
    const toastId = toast.loading('Görsel analiz ediliyor...');

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: "Bu teknik servis formundan veya ekran görüntüsünden şu bilgileri ayıkla: customerName (Ad Soyad), customerPhone (Telefon), customerAddress (Adres), deviceBrand (Cihaz Markası), deviceType (Cihaz Türü), deviceModel (Cihaz Modeli), faultDescription (Arıza Açıklaması). Eğer bulamazsan boş bırak." },
              { inlineData: { data: base64Data, mimeType: file.type } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              customerName: { type: Type.STRING },
              customerPhone: { type: Type.STRING },
              customerAddress: { type: Type.STRING },
              deviceBrand: { type: Type.STRING },
              deviceType: { type: Type.STRING },
              deviceModel: { type: Type.STRING },
              faultDescription: { type: Type.STRING },
            }
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      setFormData(prev => ({
        ...prev,
        customerName: result.customerName || prev.customerName,
        customerPhone1: result.customerPhone || prev.customerPhone1,
        customerAddress: result.customerAddress || prev.customerAddress,
        deviceBrand: result.deviceBrand || prev.deviceBrand,
        deviceType: result.deviceType || prev.deviceType,
        deviceModel: result.deviceModel || prev.deviceModel,
        faultDescription: result.faultDescription || prev.faultDescription,
      }));

      toast.success('Bilgiler görselden başarıyla alındı', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Görsel taranamadı', { id: toastId });
    } finally {
      setScanLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const onSubmit = async () => {
    if (!user) return;
    if (!formData.customerName || !formData.customerPhone1 || !formData.deviceBrand || !formData.faultDescription) {
      toast.error('Lütfen zorunlu alanları doldurun (*)');
      return;
    }
    
    setLoading(true);
    try {
      const docData = {
        ...formData,
        warrantyYears: Number(formData.warrantyYears) || 0,
        serviceId: Math.floor(100000 + Math.random() * 900000).toString(),
        status: 'Teknisyen Yönlendir',
        repairPrice: 0,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'serviceRecords'), docData);
      
      // Auto-create initial log
      await addDoc(collection(db, `serviceRecords/${docRef.id}/logs`), {
        actionName: 'Çağrı Merkezi',
        description: `Servis kaydı açıldı. Arıza: ${formData.faultDescription}`,
        createdAt: new Date().toISOString()
      });
      
      toast.success('Servis kaydı oluşturuldu');
      navigate(`/service/${docRef.id}`);
    } catch (error) {
      toast.error('Hata oluştu');
      handleFirestoreError(error, OperationType.CREATE, 'serviceRecords');
    } finally {
      setLoading(false);
    }
  };

  const SectionTitle = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <div className="flex items-center gap-2 bg-card border-x border-t border-border rounded-t-xl px-4 py-3 -mb-1 relative z-10 w-fit">
      <div className="bg-primary/20 p-1.5 rounded-lg text-primary">
        <Icon className="w-4 h-4" />
      </div>
      <h2 className="text-sm font-bold tracking-wider text-muted-foreground uppercase">{title}</h2>
    </div>
  );

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-between items-center text-xs px-1 text-muted-foreground">
        <div className="flex items-center gap-1">📅 {format(new Date(), 'dd.MM.yyyy')}</div>
        <div className="flex items-center gap-1">⏱️ {format(new Date(), 'HH:mm')}</div>
        <div className="flex items-center gap-1">👤 {user?.email?.split('@')[0] || 'admin'}</div>
      </div>

      {/* AI Scan Toolbar */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex flex-col items-center text-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="bg-primary/20 p-3 rounded-full text-primary">
          {scanLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Scan className="w-6 h-6" />}
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Görselden Bilgi Aktar</h3>
          <p className="text-xs text-muted-foreground mt-1">Ekran görüntüsü veya fotoğraf yükleyerek formu otomatik doldurabilirsin.</p>
        </div>
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleImageScan}
        />
        <Button 
          disabled={scanLoading} 
          onClick={() => fileInputRef.current?.click()}
          className="bg-primary text-black font-bold rounded-xl h-10 px-6 border-b-2 border-primary/50 shadow-md"
        >
          {scanLoading ? 'Taranıyor...' : '📸 GÖRSEL TARAT'}
        </Button>
      </div>

      {/* Customer Info Form */}
      <div>
        <SectionTitle icon={User} title="Müşteri Bilgileri" />
        <div className="bg-card border border-border rounded-xl rounded-tl-none p-4 space-y-4 shadow-lg">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Müşteri Tipi</Label>
              <Select value={formData.customerType} onValueChange={v => handleSelectChange('customerType', v)}>
                <SelectTrigger className="bg-background border-border h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bireysel">Bireysel</SelectItem>
                  <SelectItem value="Kurumsal">Kurumsal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Ad Soyad <span className="text-red-500">*</span></Label>
              <Input name="customerName" value={formData.customerName} onChange={handleChange} placeholder="Ad Soyad" className="bg-background border-border h-11" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Telefon 1 <span className="text-red-500">*</span></Label>
              <Input name="customerPhone1" value={formData.customerPhone1} onChange={handleChange} placeholder="05XX XXX XXXX" className="bg-background border-border h-11" />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Telefon 2</Label>
              <Input name="customerPhone2" value={formData.customerPhone2} onChange={handleChange} placeholder="05XX XXX XXXX" className="bg-background border-border h-11" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">İl <span className="text-red-500">*</span></Label>
              <Input name="customerCity" value={formData.customerCity} onChange={handleChange} placeholder="İl giriniz..." className="bg-background border-border h-11" />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">İlçe</Label>
              <Input name="customerDistrict" value={formData.customerDistrict} onChange={handleChange} placeholder="İlçe giriniz..." className="bg-background border-border h-11" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Adres <span className="text-red-500">*</span></Label>
            <Textarea name="customerAddress" value={formData.customerAddress} onChange={handleChange} placeholder="Açık adres..." className="min-h-[80px] bg-background border-border resize-none" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">TC/Vergi No</Label>
            <Input name="customerTaxNo" value={formData.customerTaxNo} onChange={handleChange} placeholder="TCKN veya Vergi No (opsiyonel)" className="bg-background border-border h-11" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Müsait Olma Zamanı</Label>
            <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-2">
              <Input type="date" name="availableDate" value={formData.availableDate} onChange={handleChange} className="bg-background border-border h-11" />
              <Input type="time" name="availableTimeStart" value={formData.availableTimeStart} onChange={handleChange} className="bg-background border-border h-11" />
              <Input type="time" name="availableTimeEnd" value={formData.availableTimeEnd} onChange={handleChange} className="bg-background border-border h-11" />
            </div>
          </div>
          
        </div>
      </div>

      {/* Device Info Form */}
      <div>
        <SectionTitle icon={MonitorSmartphone} title="Cihaz Bilgileri" />
        <div className="bg-card border border-border rounded-xl rounded-tl-none p-4 space-y-4 shadow-lg">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Marka <span className="text-red-500">*</span></Label>
              <Input name="deviceBrand" value={formData.deviceBrand} onChange={handleChange} placeholder="Marka giriniz..." className="bg-background border-border h-11" />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tür <span className="text-red-500">*</span></Label>
              <Input name="deviceType" value={formData.deviceType} onChange={handleChange} placeholder="Cihaz türü..." className="bg-background border-border h-11" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Model</Label>
              <Input name="deviceModel" value={formData.deviceModel} onChange={handleChange} placeholder="Model adı/kodu" className="bg-background border-border h-11" />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Seri No</Label>
              <Input name="deviceSerialNo" value={formData.deviceSerialNo} onChange={handleChange} placeholder="Seri numarası" className="bg-background border-border h-11" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Arıza Açıklaması <span className="text-red-500">*</span></Label>
            <Textarea name="faultDescription" value={formData.faultDescription} onChange={handleChange} placeholder="Müşterinin bildirdiği arıza..." className="min-h-[80px] bg-background border-border resize-none" />
          </div>

          <div className="w-full md:w-1/2 space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Garanti Süresi (Yıl)</Label>
            <Select value={formData.warrantyYears} onValueChange={v => handleSelectChange('warrantyYears', v)}>
              <SelectTrigger className="bg-background border-border h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Yok (0)</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
        </div>
      </div>

      {/* Extra Info Form */}
      <div>
        <SectionTitle icon={StickyNote} title="Ek Bilgiler" />
        <div className="bg-card border border-border rounded-xl rounded-tl-none p-4 space-y-4 shadow-lg">
          
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Teknisyen Adı (PDF formunda görünür)</Label>
            <Input name="technicianName" value={formData.technicianName} onChange={handleChange} placeholder="Örn: GEZİCİ EKİP CAN KARACA" className="bg-background border-border h-11" />
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Operatör Notu</Label>
            <Input name="operatorNote" value={formData.operatorNote} onChange={handleChange} placeholder="Özel not, yönlendirme..." className="bg-background border-border h-11" />
          </div>
          
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border flex gap-3 max-w-2xl mx-auto z-20">
        <Button variant="outline" className="w-1/3 bg-card border-border h-12" onClick={() => navigate(-1)}>
          İptal
        </Button>
        <Button className="w-2/3 bg-primary text-black font-semibold h-12" onClick={onSubmit} disabled={loading}>
          💾 KAYDET & DEVAM &rarr;
        </Button>
      </div>

    </div>
  );
}
