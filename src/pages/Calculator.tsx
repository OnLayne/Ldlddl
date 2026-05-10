import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Calculator() {
  const [amount, setAmount] = useState('');
  const [percentage, setPercentage] = useState('');
  
  const result = (parseFloat(amount) * parseFloat(percentage)) / 100;
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold border-b border-border pb-4">Yüzde Hesaplama</h1>
      
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-6">
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground tracking-wider font-bold">Tutar</Label>
          <Input 
            type="number" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            placeholder="Örn: 1000"
            className="h-12 bg-background text-lg"
          />
        </div>
        
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground tracking-wider font-bold">Yüzde (%)</Label>
          <Input 
            type="number" 
            value={percentage} 
            onChange={(e) => setPercentage(e.target.value)} 
            placeholder="Örn: 18"
            className="h-12 bg-background text-lg"
          />
        </div>
        
        <div className="pt-4 border-t border-border mt-6">
          <Label className="text-xs uppercase text-muted-foreground tracking-wider font-bold">Sonuç</Label>
          <div className="text-4xl font-black text-primary mt-2">
            {!isNaN(result) ? result.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '0'} ₺
          </div>
          
          {!isNaN(result) && amount && (
            <div className="flex justify-between mt-4 text-sm text-muted-foreground bg-muted p-3 rounded-xl border border-border">
              <span>Toplam + Yüzde:</span>
              <span className="font-bold text-foreground">{(parseFloat(amount) + result).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
