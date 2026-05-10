import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { ServiceRecord } from '../types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import SignatureCanvas from 'react-signature-canvas';

export function PublicSign() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const forced = searchParams.get('forced') === 'true';
  const [record, setRecord] = useState<ServiceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const sigPad = useRef<any>(null);
  const [isSigned, setIsSigned] = useState(false);
  
  const isIntakeNeeded = record && (!record.intakeSignature || forced);
  const isDeliveryNeeded = record && (record.intakeSignature || record.customerSignature) && (!record.deliverySignature || forced) && record.status === 'Cihaz Teslim Edildi';
  
  const [currentStep, setCurrentStep] = useState<'intake' | 'delivery' | 'done'>('done');

  useEffect(() => {
    if (!id) return;
    const fetchDoc = async () => {
      try {
        const docRef = doc(db, 'serviceRecords', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRecord({ id: docSnap.id, ...docSnap.data() } as ServiceRecord);
        } else {
          toast.error('Kayıt bulunamadı!');
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, `serviceRecords/${id}`);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [id]);

  useEffect(() => {
    if (record) {
      if (isIntakeNeeded) setCurrentStep('intake');
      else if (isDeliveryNeeded) setCurrentStep('delivery');
      else setCurrentStep('done');
    }
  }, [record, isIntakeNeeded, isDeliveryNeeded]);

  useEffect(() => {
    const handleResize = () => {
      if (sigPad.current) {
        const canvas = sigPad.current.getCanvas();
        const parent = canvas.parentElement;
        if (parent) {
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          canvas.width = parent.offsetWidth * ratio;
          canvas.height = parent.offsetHeight * ratio;
          canvas.getContext('2d').scale(ratio, ratio);
          sigPad.current.clear(); 
        }
      }
    };
    const timeoutId = setTimeout(handleResize, 100);
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleSaveSignature = async () => {
    console.log("HandleSaveSignature called", { id, sigPadEmpty: sigPad.current?.isEmpty(), currentStep });
    if (sigPad.current?.isEmpty() || !id) {
      toast.error('Lütfen imza alanını doldurun');
      return;
    }
    const signature = sigPad.current.getTrimmedCanvas().toDataURL('image/png');
    
    try {
      console.log("Saving signature...");
      const updateData: any = { updatedAt: new Date().toISOString() };
      if (currentStep === 'intake') updateData.intakeSignature = signature;
      else if (currentStep === 'delivery') updateData.deliverySignature = signature;
      
      await updateDoc(doc(db, 'serviceRecords', id), updateData);
      
      // Update local record to trigger state updates!                
      setRecord({ ...record, ...updateData });
      
      try {
        await addDoc(collection(db, `serviceRecords/${id}/logs`), {
          actionName: 'Dijital İmza Onayı',
          description: currentStep === 'intake' ? 'Müşteri servis kaydını imzaladı.' : 'Müşteri servis teslimatını imzaladı.',
          createdAt: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Log error', logErr);
      }

      setIsSigned(true);
      toast.success('İmzanız başarıyla kaydedildi.');
    } catch(e) {
      console.error('Signature save error', e);
      toast.error('İmza kaydedilirken bir hata oluştu');
    }
  };

  if (loading) return <div className="p-4 text-center mt-10">Yükleniyor...</div>;
  if (!record) return <div className="p-4 text-center mt-10">Kayıt bulunamadı.</div>;

  if (currentStep === 'done' || isSigned) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Teşekkürler</h2>
        <p className="text-muted-foreground">İmzanız alınmıştır. Geçmiş olsun dileriz.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col p-4 max-w-lg mx-auto">
      <div className="text-center mb-6 mt-4">
        <div className="mb-4">
          <div className="text-primary font-bold text-2xl tracking-tighter">BÖLGE MERKEZ SERVİSİ</div>
          <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-[0.2em]">Teknik Hizmetler ve Çözüm Merkezi</div>
        </div>
        <h1 className="text-xl font-bold text-foreground">
            Servis Kayıt Onay Formu
        </h1>
        <p className="text-sm text-primary">#{record.serviceId}</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 shadow-xl space-y-4 mb-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase mb-1 font-bold">Müşteri</p>
          <p className="font-medium text-lg">{record.customerName}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase mb-1">Cihaz</p>
            <p className="font-medium">{record.deviceBrand} {record.deviceType}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase mb-1">Model</p>
            <p className="font-medium">{record.deviceModel || '-'}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase mb-1 font-bold text-red-500">
            {currentStep === 'intake' ? 'Arıza Açıklaması' : 'Arıza ve Yapılan İşlemler'}
          </p>
          <div className="bg-muted/30 p-2 rounded text-sm whitespace-pre-wrap leading-relaxed border-l-2 border-primary">
            {currentStep === 'intake' ? record.faultDescription : (record.actionsTaken || record.faultDescription)}
          </div>
        </div>
        <div className="pt-2 border-t border-border flex justify-between items-center">
          <p className="text-xs text-muted-foreground uppercase font-bold">TOPLAM SERVİS TUTARI</p>
          <p className="font-bold text-2xl text-primary">{record.repairPrice.toLocaleString('tr-TR')} ₺</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2 tracking-widest text-center italic">Garanti ve Hizmet Şartları</h3>
        <div className="bg-muted/50 rounded-xl p-4 text-[10px] space-y-2 text-muted-foreground border border-border leading-snug max-h-48 overflow-y-auto">
          <p><span className="font-bold text-foreground">1.</span> Yapılan işlemler ve değiştirilen parçalar için <span className="font-bold text-primary">1 yıl işçilik garantisi</span> verilir. Garanti yalnızca yapılan işlem ve parça ile sınırlıdır.</p>
          <p><span className="font-bold text-foreground">2.</span> Kullanıcı hatası, darbe, sıvı teması, elektrik dalgalanması ve yetkisiz müdahale garanti kapsamı dışındadır.</p>
          <p><span className="font-bold text-foreground">3.</span> Onarım görmüş cihaza üçüncü kişilerce müdahale edilmesi halinde garanti sona erer.</p>
          <p><span className="font-bold text-foreground">4.</span> Aynı arızanın tekrarında, arızanın firmadan kaynaklanmadığı tespit edilirse yeniden servis ücreti alınabilir.</p>
          <p><span className="font-bold text-foreground">5.</span> Müşteri onayı sonrası iptallerde; arıza tespit, parça ve lojistik giderleri tahsil edilir. Ön ödemelerde masraflar düşülerek kalan iade edilir.</p>
          <p><span className="font-bold text-foreground">6.</span> Teslim edilen cihazlar 1 yıl içinde alınmazsa sorumluluk kabul edilmez.</p>
          <p><span className="font-bold text-foreground">7.</span> Fatura, hizmet verilen kişi/kurum adına düzenlenir. Bu form fatura yerine geçmez.</p>
          <p><span className="font-bold text-foreground">8.</span> Garanti ve servis taleplerinde form ibrazı zorunludur.</p>
          <p><span className="font-bold text-foreground">9.</span> Müşteri; işlem, ücret ve garanti şartları hakkında bilgilendirildiğini kabul eder.</p>
          
          <div className="my-4 border-t border-border/50 pt-4">
            <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider mb-3 text-center">Servis İstasyonlarının Sorumlulukları</h4>
            <div className="space-y-2">
              <p><span className="font-bold text-foreground">(1)</span> Tüketicinin bulunduğu yerde yetkili servis istasyonunun olmaması halinde satış sonrası hizmetlerin verilmesinden, tüketiciye en yakın yerdeki yetkili servis sorumludur.</p>
              <p><span className="font-bold text-foreground">(2)</span> Tüketiciye en yakın yetkili servis istasyonunda hizmet verilmesinin mümkün olmaması durumunda malın nakliyesi ile ilgili tüketiciden herhangi bir ulaşım gideri talep edilemez.</p>
              <p><span className="font-bold text-foreground">(3)</span> Servis istasyonlarının, ilgili yönetmelikte belirtilen belgeleri düzenlemesi ve bir nüshasını tüketiciye vermesi zorunludur.</p>
              <p><span className="font-bold text-foreground">(4)</span> Bakım ve onarım süresi azami tamir süresini geçemez. (Servis hizmetleri, üretici veya ithalatçı firmalardan bağımsız olarak faaliyet gösteren özel teknik servis kapsamında sunulmaktadır.)</p>
              <p><span className="font-bold text-foreground">(5)</span> Malın tamirinin tamamlandığı tarih tüketiciye telefon, kısa mesaj, e-posta veya benzeri yollarla bildirilir.</p>
              <p><span className="font-bold text-foreground">(6)</span> Garanti dışı hizmetlerde, aynı arızanın 1 yıl içinde tekrarı halinde ücret talep edilmez (kullanım hatası hariç).</p>
              <p><span className="font-bold text-foreground">(7)</span> Değiştirilen parçalar için en az 12 ay garanti verilir.</p>
              <p><span className="font-bold text-foreground">(8)</span> Cihaz onarım süresi maksimum 21 iş günüdür.</p>
              <p><span className="font-bold text-foreground">(9)</span> 30 gün içerisinde teslim alınmayan cihazlardan servis sorumlu değildir.</p>
              <p><span className="font-bold text-foreground">(10)</span> İşlem iptallerinde ücret iadesi yapılmaz.</p>
              <p><span className="font-bold text-foreground">(11)</span> İşlem iptali ile geri talep edilen cihazlarda 3000 TL hizmet bedeli uygulanır.</p>
              <p><span className="font-bold text-foreground">(12)</span> Muadil parça kullanımı veya revizyon yapılabileceği bilgisi tüketiciye verilmiş olup hizmet kapsamında değerlendirilmektedir.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 flex-1 flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
         <p className="text-sm mb-4 font-medium">Lütfen aşağıya {currentStep === 'intake' ? 'servis kaydı' : 'servis teslimat'} imzanızı atın:</p>
         <div className="w-full h-48 border-2 border-dashed border-primary/50 bg-white/5 rounded-xl overflow-hidden mb-4 relative touch-none">
            <SignatureCanvas 
              ref={sigPad} 
              canvasProps={{className: 'w-full h-full absolute inset-0'}} 
              penColor="#fbbf24"
            />
         </div>
         <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={() => sigPad.current?.clear()}>Temizle</Button>
            <Button className="flex-1 bg-primary text-black font-bold" onClick={handleSaveSignature}>Onayla ve İmzala</Button>
         </div>
         
         <p className="text-[10px] text-muted-foreground mt-6 text-center leading-tight">
           Onayla ve İmzala butonuna basarak, {currentStep === 'intake' ? 'belirtilen arıza kaydını' : 'yapılan işlemleri, ücret bilgisini ve garanti şartlarını kontrol ettiğimi, cihazımı eksiksiz teslim aldığımı'} beyan ve kabul ederim.
         </p>
      </div>
    </div>
  );
}
