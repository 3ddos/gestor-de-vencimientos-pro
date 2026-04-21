import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Server, 
  Smartphone, 
  Mail, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  DollarSign, 
  UserPlus, 
  LogOut,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Client {
  id: number;
  domain: string;
  sub_seller_name: string;
  responsible: 'Gnomo' | 'Leo';
  client_email: string;
  client_phone: string;
  hosting_expiry: string;
  ssl_technical_expiry: string;
  ssl_price: number;
  health: 'red' | 'orange' | 'green';
  daysRemaining: number;
  [key: string]: any;
}

interface Payment {
  id: number;
  date: string;
  amount: number;
  currency: string;
  concept: string;
}

interface SubSeller {
  id: number;
  name: string;
  responsible: string;
}

// --- Components ---

const StatusBadge = ({ health, days }: { health: string, days: number }) => {
  const configs = {
    red: { color: 'text-red-600', dot: 'bg-red-600', label: 'CRÍTICO' },
    orange: { color: 'text-orange-600', dot: 'bg-orange-500', label: 'PRÓXIMO' },
    green: { color: 'text-emerald-600', dot: 'bg-emerald-600', label: 'AL DÍA' },
  };
  const config = configs[health as keyof typeof configs];

  return (
    <div className="flex items-center gap-2">
      <div className={cn("status-dot", config.dot)} />
      <span className={cn("text-xs font-bold", config.color)}>
        {config.label} ({days < 0 ? `vencido ${Math.abs(days)}d` : `${days}d`})
      </span>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [showSellerModal, setShowSellerModal] = useState(false);
  const [sellers, setSellers] = useState<SubSeller[]>([]);

  useEffect(() => {
		checkAuth();
	}, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) setUser(await res.json());
    } catch (e) {} finally { setLoading(false); }
  };

  const loadData = async () => {
    const [cRes, sRes] = await Promise.all([
      fetch('/api/clients'),
      fetch('/api/sub-sellers')
    ]);
    if (cRes.ok) setClients(await cRes.json());
    if (sRes.ok) setSellers(await sRes.json());
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    });
    if (res.ok) setUser(await res.json());
    else alert('Error en el login');
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
  };

  if (loading) return null;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-200"
        >
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Acceso al Portal</h1>
            <p className="text-slate-500 mt-2">Sistema de Gestión de Clientes</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Usuario</label>
              <input 
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={loginData.username}
                onChange={e => setLoginData({...loginData, username: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
              <input 
                type="password"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={loginData.password}
                onChange={e => setLoginData({...loginData, password: e.target.value})}
              />
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-200">
              Ingresar
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shrink-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold">R</div>
            <span className="font-bold text-lg text-slate-900 tracking-tight">Renovaciones Central v2.4</span>
          </div>
          <div className="flex items-center gap-4">
             <button 
              onClick={() => setShowSellerModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:bg-slate-100 rounded transition-all"
            >
              <Users size={16} />
              Vendedores
            </button>
            <div className="flex items-center gap-3 text-right">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase leading-none">Vendedor Activo</p>
                <p className="text-sm font-semibold text-slate-700">{user.username}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-slate-200" />
              </div>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors ml-2">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-6">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Críticos</p>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-black text-red-600">{clients.filter(c => c.health === 'red').length}</span>
              <span className="text-[10px] text-red-600 font-bold uppercase">Vencen &lt; 10d</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Próximos</p>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-black text-orange-500">{clients.filter(c => c.health === 'orange').length}</span>
              <span className="text-[10px] text-orange-500 font-bold uppercase">11 a 20 días</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Al Día</p>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-black text-emerald-600">{clients.filter(c => c.health === 'green').length}</span>
              <span className="text-[10px] text-emerald-600 font-bold uppercase">OK (&gt; 20d)</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Cobrado (Visual)</p>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-black text-slate-700">Ref</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">USD</span>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Cliente / Dominio</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Servicios Activos</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Estado Salud</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Próximo Vencimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((client) => (
                  <ClientRow 
                    key={client.id} 
                    client={client} 
                    isExpanded={expandedId === client.id}
                    onToggle={() => setExpandedId(expandedId === client.id ? null : client.id)}
                    onRefresh={loadData}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Seller Management Modal (Simplified) */}
      <AnimatePresence>
        {showSellerModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6"
             >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900">Gestión de Sub-vendedores</h3>
                  <button onClick={() => setShowSellerModal(false)} className="text-slate-400 hover:text-slate-600">×</button>
                </div>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto mb-6">
                  {sellers.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div>
                        <p className="font-semibold text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Asignado a: {s.responsible}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  className="w-full py-2 bg-slate-100 rounded-lg text-slate-600 font-medium hover:bg-slate-200 transition-colors"
                  onClick={() => setShowSellerModal(false)}
                >
                  Cerrar
                </button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ClientRowProps {
  client: Client;
  isExpanded: boolean;
  onToggle: () => void;
  onRefresh: () => Promise<void> | void;
  key?: any;
}

const ClientRow = ({ client, isExpanded, onToggle, onRefresh }: ClientRowProps) => {
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    if (isExpanded) {
      fetch(`/api/clients/${client.id}/payments`).then(r => r.json()).then(setPayments);
    }
  }, [isExpanded, client.id]);

  const handleRenewSSL = async () => {
    if (!confirm('¿Registrar renovación de SSL técnico por 90 días?')) return;
    const res = await fetch(`/api/clients/${client.id}/renew-ssl`, { method: 'POST' });
    if (res.ok) onRefresh();
  };

  const handleRecordPayment = async () => {
    const amountStr = prompt('Monto del cobro:');
    if (!amountStr) return;
    const res = await fetch(`/api/clients/${client.id}/record-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(amountStr),
        currency: 'USD',
        concept: 'Renovación Anual Hosting + SSL'
      })
    });
    if (res.ok) {
      onRefresh();
      alert('Pago registrado y hosting renovado por 1 año.');
    }
  };

  return (
    <>
      <tr 
        onClick={onToggle}
        className={cn(
          "cursor-pointer transition-colors border-l-4 border-transparent hover:bg-slate-50/50",
          client.health === 'red' && "urgent-row-bg",
          client.health === 'orange' && "warning-row-bg",
          client.health === 'green' && "safe-row-bg",
          isExpanded && "bg-slate-50/80!"
        )}
      >
        <td className="px-6 py-4">
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 text-base">{client.domain}</span>
            <span className="text-xs text-slate-500">SubV: {client.sub_seller_name} / Resp: {client.responsible}</span>
          </div>
        </td>
        <td className="px-6 py-4">
            <div className="flex gap-2">
              <div className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight shadow-sm">HOSTING</div>
              <div className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight shadow-sm">SSL técnico</div>
            </div>
        </td>
        <td className="px-6 py-4">
            <StatusBadge health={client.health} days={client.daysRemaining} />
        </td>
        <td className="px-6 py-4">
          <span className={cn(
            "font-mono text-sm font-bold",
            client.health === 'red' ? "text-red-600" : client.health === 'orange' ? "text-orange-600" : "text-slate-500"
          )}>
            {new Date(client.hosting_expiry).toLocaleDateString('es-ES')}
          </span>
        </td>
        <td className="px-6 py-4 w-10">
          <div className="text-slate-300">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </td>
      </tr>
      <AnimatePresence>
        {isExpanded && (
          <tr>
            <td colSpan={5} className="bg-slate-50 px-6 py-6 border-b border-slate-200 shadow-inner">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Info Column */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[10px] uppercase font-black text-slate-400 mb-4 tracking-widest">Gestión Comercial</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <p className="text-slate-500 font-medium">Ciclo:</p>
                        <p className="font-bold text-slate-700">Anual (1 Año)</p>
                        <p className="text-slate-500 font-medium">Hosting:</p>
                        <p className="font-bold text-slate-700">$120.00 USD</p>
                        <p className="text-slate-500 font-medium">SSL Técnico:</p>
                        <p className="font-bold text-slate-700">${client.ssl_price ? client.ssl_price.toFixed(2) : '0.00'} USD</p>
                        <p className="text-slate-500 font-medium">Responsable:</p>
                        <p className="font-bold text-slate-700">{client.responsible} ({client.sub_seller_name})</p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRenewSSL(); }}
                        className="bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest py-2 px-4 rounded hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
                      >
                        Renovar SSL Técnico
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRecordPayment(); }}
                        className="bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest py-2 px-4 rounded hover:bg-emerald-700 transition shadow-lg shadow-emerald-100"
                      >
                        Registrar Cobro
                      </button>
                    </div>
                  </div>

                  {/* Contact Column */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[10px] uppercase font-black text-slate-400 mb-4 tracking-widest">Datos de Contacto</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                          <Mail size={14} className="text-slate-400" />
                          <span>{client.client_email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Smartphone size={14} className="text-emerald-500" />
                          <a 
                            href={`https://wa.me/${client.client_phone}`} 
                            target="_blank" 
                            className="font-bold text-emerald-700 underline flex items-center gap-1"
                          >
                            WhatsApp Directo <ExternalLink size={10} />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* History Column */}
                  <div className="bg-white rounded border border-slate-200 p-4 shadow-sm">
                    <h4 className="text-[10px] uppercase font-black text-slate-400 mb-4 tracking-widest">Historial de Cobros</h4>
                    <table className="w-full text-xs inner-table">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left font-bold text-slate-500 pb-2">Fecha</th>
                          <th className="text-left font-bold text-slate-500 pb-2">Concepto</th>
                          <th className="text-right font-bold text-slate-500 pb-2">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {payments.length > 0 ? payments.slice(0, 3).map(p => (
                          <tr key={p.id}>
                            <td className="py-2 text-slate-600 font-medium">{new Date(p.date).toLocaleDateString('es-ES')}</td>
                            <td className="py-2 text-slate-500">{p.concept}</td>
                            <td className="py-2 text-right font-bold text-slate-700">${p.amount.toFixed(2)}</td>
                          </tr>
                        )) : (
                          <tr><td colSpan={3} className="py-4 text-center text-slate-400 italic font-medium">Sin registros anteriores</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
};
