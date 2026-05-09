import React from 'react';
import { ServiceRecord, ServiceLog, Transaction } from '../../types';
import { format, addYears, differenceInDays, parseISO } from 'date-fns';

interface PdfTemplateProps {
  record: ServiceRecord;
  logs: ServiceLog[];
  transactions: Transaction[];
}

export const PdfTemplate = React.forwardRef<HTMLDivElement, PdfTemplateProps>(({ record, logs, transactions }, ref) => {
  const totalTx = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  const calculateWarrantyInfo = (createdAt: string, years: number) => {
    if (!years || years <= 0) return 'Yok / Bitti';
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

  return (
    <div 
      ref={ref} 
      data-pdf-template="true"
      className="bg-[#ffffff] text-[#000000] p-8"
      style={{
        width: '794px', // Standard A4 width at 96dpi
        minHeight: '1123px', // Standard A4 height at 96dpi
        fontFamily: "'Inter', sans-serif",
        backgroundColor: '#ffffff',
        color: '#000000'
      }}
    >
      {/* Header */}
      <div className="mb-4 w-full flex justify-between items-center border-b-2 pb-4" style={{ borderColor: '#1e3a8a' }}>
        <div>
          <div className="text-[#1e3a8a] font-bold text-2xl tracking-tighter">BÖLGE MERKEZ SERVİSİ</div>
          <div className="text-gray-500 text-xs font-medium uppercase tracking-[0.2em]">Teknik Hizmetler ve Çözüm Merkezi</div>
        </div>
        <div className="text-right">
          <div className="text-[#1e3a8a] font-bold text-sm">7/24 MÜŞTERİ HİZMETLERİ</div>
          <div className="text-gray-600 font-bold text-lg">0850 305 29 96</div>
        </div>
      </div>

      {/* Blue Bar */}
      <div className="flex justify-between items-center px-4 py-1.5 text-xs font-medium" style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
        <div>— SERVİS FORMU —</div>
        <div>Servis No: <span className="font-bold text-base">#{record.serviceId}</span></div>
        <div>Kayıt: {format(new Date(record.createdAt), 'dd.MM.yyyy HH:mm')} &nbsp;&nbsp;&nbsp; Dok: BMS-2026-8130</div>
      </div>

      <div className="grid grid-cols-2 mt-4 text-xs h-[160px]">
        {/* Customer Info */}
        <div className="border" style={{ borderColor: '#bfdbfe' }}>
          <div className="font-bold px-3 py-1.5 border-b uppercase" style={{ backgroundColor: '#eff6ff', color: '#1e3a8a', borderColor: '#bfdbfe' }}>MÜŞTERİ BİLGİLERİ</div>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-[100px_1fr]"><span style={{ color: '#6b7280' }}>Ad Soyad</span><span className="font-bold">{record.customerName}</span></div>
            <div className="grid grid-cols-[100px_1fr]"><span style={{ color: '#6b7280' }}>Telefon</span><span>{record.customerPhone1} {record.customerPhone2 ? ` / ${record.customerPhone2}` : ''}</span></div>
            <div className="grid grid-cols-[100px_1fr]"><span style={{ color: '#6b7280' }}>Adres</span><span>{record.customerAddress}, {record.customerDistrict} / {record.customerCity}</span></div>
            <div className="grid grid-cols-[100px_1fr]"><span style={{ color: '#6b7280' }}>TC / Vergi No</span><span>{record.customerTaxNo || '—'}</span></div>
            <div className="grid grid-cols-[100px_1fr]"><span style={{ color: '#6b7280' }}>Müsait Zaman</span><span>{record.availableDate} / {record.availableTimeStart} - {record.availableTimeEnd}</span></div>
            <div className="grid grid-cols-[100px_1fr]"><span style={{ color: '#6b7280' }}>Teknisyen</span><span className="font-bold">{record.technicianName || '—'}</span></div>
          </div>
        </div>
        
        {/* Device Info */}
        <div className="border border-l-0" style={{ borderColor: '#bfdbfe' }}>
          <div className="font-bold px-3 py-1.5 border-b uppercase" style={{ backgroundColor: '#eff6ff', color: '#1e3a8a', borderColor: '#bfdbfe' }}>CİHAZ BİLGİLERİ</div>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-[100px_1fr]"><span style={{ color: '#6b7280' }}>Marka / Tür</span><span className="font-bold">{record.deviceBrand}&nbsp;&nbsp;&nbsp;{record.deviceType}</span></div>
            <div className="grid grid-cols-[100px_1fr]"><span style={{ color: '#6b7280' }}>Model</span><span>{record.deviceModel || '—'}</span></div>
            <div className="grid grid-cols-[100px_1fr]"><span style={{ color: '#6b7280' }}>Seri No</span><span>{record.deviceSerialNo || '—'}</span></div>
            <div className="grid grid-cols-[100px_1fr]"><span className="font-bold" style={{ color: '#ef4444' }}>Arıza</span><span className="font-bold" style={{ color: '#ef4444' }}>{record.faultDescription || '—'}</span></div>
            <div className="grid grid-cols-[100px_1fr]"><span style={{ color: '#6b7280' }}>Garanti Bitiş</span><span className="font-medium" style={{ color: '#16a34a' }}>{calculateWarrantyInfo(record.createdAt, record.warrantyYears)}</span></div>
            <div className="grid grid-cols-[100px_1fr]"><span style={{ color: '#6b7280' }}>Durum</span><span className="font-medium" style={{ color: '#2563eb' }}>{record.status}</span></div>
          </div>
        </div>
      </div>

      {/* Diagnostics & Operations */}
      <div className="border mt-4 text-xs" style={{ borderColor: '#bfdbfe' }}>
        <div className="font-bold px-3 py-1.5 border-b uppercase" style={{ backgroundColor: '#eff6ff', color: '#1e3a8a', borderColor: '#bfdbfe' }}>TEKNİSYEN ARIZA TESPİTİ VE YAPILAN İŞLEMLER</div>
        <div className="grid grid-cols-[120px_1fr] border-b" style={{ borderColor: '#dbeafe' }}>
          <div className="p-3 border-r" style={{ color: '#6b7280', borderColor: '#dbeafe' }}>Arıza Tespiti</div>
          <div className="p-3 whitespace-pre-wrap font-bold">{record.faultDiagnosis || '—'}</div>
        </div>
        <div className="grid grid-cols-[120px_1fr] border-b" style={{ borderColor: '#dbeafe' }}>
          <div className="p-3 border-r" style={{ color: '#6b7280', borderColor: '#dbeafe' }}>Yapılan İşlemler</div>
          <div className="p-3 whitespace-pre-wrap">{record.actionsTaken || '—'}</div>
        </div>
        <div className="grid grid-cols-[120px_1fr] border-b" style={{ borderColor: '#dbeafe' }}>
          <div className="p-3 border-r" style={{ color: '#6b7280', borderColor: '#dbeafe' }}>Kullanılan Parça</div>
          <div className="p-3 whitespace-pre-wrap">{record.partsUsed || '—'}</div>
        </div>
        <div className="grid grid-cols-[120px_1fr]" style={{ backgroundColor: '#eff6ff' }}>
          <div className="p-3 font-bold border-r" style={{ color: '#374151', borderColor: '#dbeafe' }}>Tamir Fiyatı</div>
          <div className="p-3 font-bold text-sm" style={{ color: '#1d4ed8' }}>{record.repairPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
        </div>
      </div>

      {/* Logs Table */}
      {logs.length > 0 && (
        <div className="mt-4 border text-xs" style={{ borderColor: '#bfdbfe' }}>
          <div className="grid grid-cols-[100px_150px_1fr] font-bold border-b uppercase" style={{ backgroundColor: '#eff6ff', color: '#1e3a8a', borderColor: '#bfdbfe' }}>
            <div className="p-2 border-r" style={{ borderColor: '#bfdbfe' }}>TARİH</div>
            <div className="p-2 border-r" style={{ borderColor: '#bfdbfe' }}>İŞLEM</div>
            <div className="p-2">AÇIKLAMA</div>
          </div>
          {logs.map((log) => (
            <div key={log.id} className="grid grid-cols-[100px_150px_1fr] border-b last:border-0" style={{ borderColor: '#dbeafe' }}>
              <div className="p-2 border-r" style={{ color: '#6b7280', borderColor: '#dbeafe' }}>
                <div className="whitespace-pre-wrap">{format(new Date(log.createdAt), 'dd.MM.yyyy\nHH:mm')}</div>
              </div>
              <div className="p-2 border-r font-bold" style={{ borderColor: '#dbeafe' }}>{log.actionName}</div>
              <div className="p-2 whitespace-pre-wrap">{log.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Financial Transactions Table */}
      {transactions.length > 0 && (
        <div className="mt-4 border text-xs" style={{ borderColor: '#bfdbfe' }}>
          <div className="grid grid-cols-[100px_1fr_100px_100px_100px] font-bold border-b uppercase" style={{ backgroundColor: '#eff6ff', color: '#1e3a8a', borderColor: '#bfdbfe' }}>
            <div className="p-2 border-r" style={{ borderColor: '#bfdbfe' }}>TARİH</div>
            <div className="p-2 border-r" style={{ borderColor: '#bfdbfe' }}>TAHSİL EDEN</div>
            <div className="p-2 border-r" style={{ borderColor: '#bfdbfe' }}>ÖDEME ŞEKLİ</div>
            <div className="p-2 border-r" style={{ borderColor: '#bfdbfe' }}>DURUM</div>
            <div className="p-2 text-right">TUTAR</div>
          </div>
          {transactions.map((tx) => (
            <div key={tx.id} className="grid grid-cols-[100px_1fr_100px_100px_100px] border-b" style={{ borderColor: '#dbeafe' }}>
              <div className="p-2 border-r" style={{ color: '#6b7280', borderColor: '#dbeafe' }}>{format(new Date(tx.createdAt), 'dd.MM.yyyy')}</div>
              <div className="p-2 border-r" style={{ borderColor: '#dbeafe' }}>{tx.actor || '—'}</div>
              <div className="p-2 border-r" style={{ borderColor: '#dbeafe' }}>{tx.method}</div>
              <div className="p-2 border-r" style={{ borderColor: '#dbeafe' }}>{tx.status}</div>
              <div className="p-2 text-right font-bold">{tx.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
            </div>
          ))}
          <div className="grid grid-cols-[auto_100px] font-bold" style={{ backgroundColor: '#eff6ff' }}>
            <div className="p-2 text-right" style={{ color: '#374151' }}>TOPLAM TAHSİLAT:</div>
            <div className="p-2 text-right text-sm" style={{ color: '#1e40af' }}>{totalTx.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
          </div>
        </div>
      )}

      {/* Signatures */}
      <div className="grid grid-cols-2 mt-6 border text-xs text-center" style={{ borderColor: '#bfdbfe' }}>
        <div className="border-r p-4" style={{ borderColor: '#bfdbfe' }}>
          <h3 className="font-bold uppercase" style={{ color: '#1e3a8a' }}>MÜŞTERİ İMZASI</h3>
          <div className="h-24 flex items-center justify-center my-2">
            {record.customerSignature ? (
              <img src={record.customerSignature} className="max-h-full" alt="Müşteri İmzası" style={{ filter: 'brightness(0)' }} />
            ) : (
              <span style={{ color: '#d1d5db' }}>İmza Yok</span>
            )}
          </div>
          <div className="mx-10 pt-2 font-medium border-t" style={{ borderColor: '#d1d5db' }}>{record.customerName}</div>
          <div className="mt-4 text-[9px] text-left opacity-70" style={{ color: '#6b7280' }}>
            Yapılan işlemleri, değiştirilen parçaları, ücret bilgisini ve garanti şartlarını kontrol ettim; eksiksiz teslim aldığımı beyan ve kabul ederim.
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-bold uppercase" style={{ color: '#1e3a8a' }}>TEKNİSYEN İMZASI</h3>
          <div className="h-24 flex items-center justify-center my-2">
            {record.technicianSignature ? (
               <img src={record.technicianSignature} className="max-h-full" alt="Teknisyen İmzası" style={{ filter: 'brightness(0)' }} />
            ) : (
              <span style={{ color: '#d1d5db' }}>İmza Yok</span>
            )}
          </div>
          <div className="mx-10 pt-2 font-medium border-t" style={{ borderColor: '#d1d5db' }}>{record.technicianName || '—'}</div>
          <div className="mt-1 text-[9px] uppercase" style={{ color: '#6b7280' }}>
            BÖLGE MERKEZ SERVİSİ<br/>Teknik Personel
          </div>
        </div>
      </div>

      {/* Footer Details */}
      <div className="mt-6 border overflow-hidden" style={{ borderColor: '#1e3a8a' }}>
        <div className="flex flex-col text-[7px] leading-[1.1]" style={{ color: '#374151' }}>
          <div className="border-b" style={{ borderColor: '#dbeafe' }}>
            <div className="text-center font-bold py-1 uppercase text-[9px]" style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
              GARANTİ VE HİZMET ŞARTLARI
            </div>
            <div className="p-3 grid grid-cols-2 gap-x-6 gap-y-1 bg-white">
              <p><span className="font-bold">1.</span> Yapılan işlemler ve değiştirilen parçalar için 1 yıl işçilik garantisi verilir. Garanti yalnızca yapılan işlem ve parça ile sınırlıdır.</p>
              <p><span className="font-bold">2.</span> Kullanıcı hatası, darbe, sıvı teması, elektrik dalgalanması ve yetkisiz müdahale garanti kapsamı dışındadır.</p>
              <p><span className="font-bold">3.</span> Onarım görmüş cihaza üçüncü kişilerce müdahale edilmesi halinde garanti sona erer.</p>
              <p><span className="font-bold">4.</span> Aynı arızanın tekrarında, arızanın firmadan kaynaklanmadığı tespit edilirse yeniden servis ücreti alınabilir.</p>
              <p><span className="font-bold">5.</span> Müşteri onayı sonrası iptallerde; arıza tespit, parça ve lojistik giderleri tahsil edilir. Ön ödemelerde masraflar düşülerek kalan iade edilir.</p>
              <p><span className="font-bold">6.</span> Teslim edilen cihazlar 1 yıl içinde alınmazsa sorumluluk kabul edilmez.</p>
              <p><span className="font-bold">7.</span> Fatura, hizmet verilen kişi/kurum adına düzenlenir. Bu form fatura yerine geçmez.</p>
              <p><span className="font-bold">8.</span> Garanti ve servis taleplerinde form ibrazı zorunludur.</p>
              <p><span className="font-bold">9.</span> Müşteri; işlem, ücret ve garanti şartları hakkında bilgilendirildiğini kabul eder.</p>
            </div>
          </div>
          <div>
            <div className="text-center font-bold py-1 uppercase text-[9px]" style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
              SERVİS İSTASYONLARININ SORUMLULUKLARI
            </div>
            <div className="p-3 grid grid-cols-2 gap-x-6 gap-y-1 bg-[#f8fafc]">
              <p><span className="font-bold">(1)</span> Tüketicinin bulunduğu yerde yetkili servis istasyonunun olmaması halinde satış sonrası hizmetlerin verilmesinden, tüketiciye en yakın yerdeki yetkili servis sorumludur.</p>
              <p><span className="font-bold">(2)</span> Tüketiciye en yakın yetkili servis istasyonunda hizmet verilmesinin mümkün olmaması durumunda malın nakliyesi ile ilgili tüketiciden herhangi bir ulaşım gideri talep edilemez.</p>
              <p><span className="font-bold">(3)</span> Servis istasyonlarının, ilgili yönetmelikte belirtilen belgeleri düzenlemesi ve bir nüshasını tüketiciye vermesi zorunludur.</p>
              <p><span className="font-bold">(4)</span> Bakım ve onarım süresi azami tamir süresini geçemez. (Servis hizmetleri, üretici veya ithalatçı firmalardan bağımsız olarak faaliyet gösteren özel teknik servis kapsamında sunulmaktadır.)</p>
              <p><span className="font-bold">(5)</span> Malın tamirinin tamamlandığı tarih tüketiciye telefon, kısa mesaj, e-posta veya benzeri yollarla bildirilir.</p>
              <p><span className="font-bold">(6)</span> Garanti dışı hizmetlerde, aynı arızanın 1 yıl içinde tekrarı halinde ücret talep edilmez (kullanım hatası hariç).</p>
              <p><span className="font-bold">(7)</span> Değiştirilen parçalar için en az 12 ay garanti verilir.</p>
              <p><span className="font-bold">(8)</span> Cihaz onarım süresi maksimum 21 iş günüdür.</p>
              <p><span className="font-bold">(9)</span> 30 gün içerisinde teslim alınmayan cihazlardan servis sorumlu değildir.</p>
              <p><span className="font-bold">(10)</span> İşlem iptallerinde ücret iadesi yapılmaz.</p>
              <p><span className="font-bold">(11)</span> İşlem iptali ile geri talep edilen cihazlarda 3000 TL hizmet bedeli uygulanır.</p>
              <p><span className="font-bold">(12)</span> Muadil parça kullanımı veya revizyon yapılabileceği bilgisi tüketiciye verilmiş olup hizmet kapsamında değerlendirilmektedir.</p>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-3 flex justify-between items-center text-xs" style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
          <div>
            <div style={{ color: '#d1d5db', fontSize: '10px' }}>İKLİM ISITMA & SOĞUTMA SİSTEMLERİ</div>
            <div className="font-bold text-base mb-2">BÖLGE MERKEZ<br/>SERVİSİ</div>
            <div className="flex items-center gap-1 mb-1">📞 0850 305 29 96</div>
            <div className="flex items-center gap-1" style={{ color: '#d1d5db' }}>🌐 bolgeservisarayin.com</div>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-bold" style={{ backgroundColor: '#22c55e', color: '#ffffff' }}>
               WhatsApp Destek Hattı
            </div>
          </div>
          <div className="text-right text-[10px] space-y-1" style={{ color: '#e5e7eb' }}>
            <div>Garanti kapsamındaki servis talepleri</div>
            <div>için bu formu ibraz ediniz.</div>
            <div className="font-bold" style={{ color: '#ffffff' }}>1 Yıl İşçilik Garantisi</div>
            <div className="text-[9px] uppercase mt-2" style={{ color: '#93c5fd' }}>ÇAĞRI MERKEZİ HİZMET AĞI</div>
          </div>
        </div>
      </div>

    </div>
  );
});

PdfTemplate.displayName = 'PdfTemplate';
