import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '../lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Shield, User, Mail, LogOut, Key, Trash2, Edit2, Check } from 'lucide-react';
import { getAuth, signOut } from 'firebase/auth';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { toast } from 'sonner';

function UserRow({ u, handleUpdateRole, handleDeleteProfile }: { u: any, handleUpdateRole: (id: string, role: UserRole) => void, handleDeleteProfile: (id: string) => void }) {
  return (
    <div className="bg-card p-4 rounded-2xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${u.role === 'ADMIN' ? 'bg-green-500/10 text-green-500' : u.role === 'TEKNISYEN' ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'}`}>
          {u.name?.charAt(0) || u.role?.charAt(0) || 'U'}
        </div>
        <div>
          <h3 className="text-sm font-bold">{u.name || (u.email?.split('@')[0])}</h3>
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{u.role} · {u.email}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
         <div className="flex bg-muted rounded-lg p-1 overflow-hidden">
            {(['ADMIN', 'TEKNISYEN', 'CAGRI_MERKEZI'] as UserRole[]).map((r) => (
              <button
                key={r}
                onClick={() => handleUpdateRole(u.id, r)}
                className={`text-[8px] font-black uppercase px-2 py-1.5 rounded-md transition-all ${u.role === r ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {r === 'CAGRI_MERKEZI' ? 'OFİS' : r}
              </button>
            ))}
         </div>
         <Button 
          onClick={() => handleDeleteProfile(u.id)} 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-red-500/50 hover:text-red-500 hover:bg-red-500/10"
         >
           <Trash2 className="w-4 h-4" />
         </Button>
      </div>
    </div>
  );
}

export function UserManagement() {
  const { user, profile } = useAuth();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'TEKNISYEN' as UserRole });
  const [creating, setCreating] = useState(false);
  
  useEffect(() => {
    if (!user || profile?.role !== 'ADMIN') {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllUsers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return unsubscribe;
  }, [user, profile]);

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success('Kullanıcı rolü güncellendi');
    } catch (error) {
      toast.error('Hata: ' + (error instanceof Error ? error.message : 'Güncellenemedi'));
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) {
      toast.error('Lütfen e-posta ve şifre giriniz');
      return;
    }
    setCreating(true);
    try {
      // NOTE: Requires Email/Password auth enabled in Firebase Console!
      const { createUserWithEmailAndPassword, getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(auth, newUser.email, newUser.password);
      
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: newUser.email,
        role: newUser.role,
        createdAt: serverTimestamp()
      });
      
      toast.success('Yeni kullanıcı oluşturuldu');
      setNewUser({ email: '', password: '', role: 'TEKNISYEN' });
    } catch (error) {
      toast.error('Hata: ' + (error instanceof Error ? error.message : 'Oluşturulamadı'));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProfile = async (userId: string) => {
    if (userId === user?.uid) {
      toast.error('Kendi profilinizi silemezsiniz');
      return;
    }
    if (!window.confirm('Bu kullanıcının yetki profilini silmek istediğinize emin misiniz? (Hata: Bu işlem sadece veritabanı kaydını siler)')) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success('Kullanıcı profili silindi');
    } catch (error) {
      toast.error('Hata: ' + (error instanceof Error ? error.message : 'Silinemedi'));
    }
  };

  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
    } catch (error) {
      console.error(error);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold border-b border-border pb-4">Kullanıcı Yönetimi</h1>
      
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center border border-primary/20">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{user.email?.split('@')[0] || 'Kullanıcı'}</h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Shield className={`w-3.5 h-3.5 ${profile?.role === 'ADMIN' ? 'text-green-500' : profile?.role === 'TEKNISYEN' ? 'text-blue-500' : 'text-orange-500'}`} />
              <span className="uppercase tracking-widest font-bold">
                {profile?.role === 'ADMIN' ? 'Yönetici Yetkisi' : profile?.role === 'TEKNISYEN' ? 'Teknisyen' : profile?.role === 'CAGRI_MERKEZI' ? 'Çağrı Merkezi' : 'Yetki Bekleniyor'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="pt-4 border-t border-border space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground tracking-wider font-bold">E-Posta Adresi</Label>
            <div className="flex items-center gap-3 bg-muted p-3 rounded-xl border border-border">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{user.email || 'Bilinmiyor'}</span>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground tracking-wider font-bold">Kullanıcı Kimliği (UID)</Label>
            <div className="flex items-center gap-3 bg-muted p-3 rounded-xl border border-border">
              <Key className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-mono">{user.uid}</span>
            </div>
          </div>
        </div>
        
        <div className="pt-4 mt-6">
          <Button onClick={handleLogout} variant="destructive" className="w-full h-11 font-bold rounded-xl gap-2 tracking-wide">
            <LogOut className="w-4 h-4" /> GÜVENLİ ÇIKIŞ YAP
          </Button>
        </div>
      </div>
      
      {profile?.role === 'ADMIN' && (
        <div className="space-y-4">
          <div className="bg-card p-6 rounded-2xl border border-border">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <User className="w-5 h-5" /> Yeni Kullanıcı Oluştur
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input placeholder="E-posta" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              <Input type="password" placeholder="Şifre" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
              <select className="bg-muted px-4 rounded-xl text-sm" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                <option value="TEKNISYEN">Teknisyen</option>
                <option value="CAGRI_MERKEZI">Çağrı Merkezi</option>
                <option value="ADMIN">Yönetici</option>
              </select>
              <Button onClick={handleCreateUser} disabled={creating}>{creating ? 'Oluşturuluyor...' : 'Oluştur'}</Button>
            </div>
          </div>
          <h2 className="text-xl font-bold mt-8 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Yöneticiler
          </h2>
          <div className="grid gap-3">
            {allUsers.filter(u => u.role === 'ADMIN').map((u) => (
              <UserRow key={u.id} u={u} handleUpdateRole={handleUpdateRole} handleDeleteProfile={handleDeleteProfile} />
            ))}
          </div>

          <h2 className="text-xl font-bold mt-8 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Teknisyenler
          </h2>
          <div className="grid gap-3">
            {allUsers.filter(u => u.role === 'TEKNISYEN').map((u) => (
              <UserRow key={u.id} u={u} handleUpdateRole={handleUpdateRole} handleDeleteProfile={handleDeleteProfile} />
            ))}
          </div>
          
          <h2 className="text-xl font-bold mt-8 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Çağrı Merkezi
          </h2>
          <div className="grid gap-3">
            {allUsers.filter(u => u.role === 'CAGRI_MERKEZI').map((u) => (
              <UserRow key={u.id} u={u} handleUpdateRole={handleUpdateRole} handleDeleteProfile={handleDeleteProfile} />
            ))}
          </div>
        </div>
      )}
      
      <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl flex items-start gap-3">
        <Shield className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
        <div className="text-sm text-orange-500/90 font-medium leading-snug">
          Yeni personel profili oluşturmak veya şifre sıfırlama işlemleri için sistem yöneticinizle (BMS/PRO Admin) görüşünüz.
        </div>
      </div>
    </div>
  );
}
