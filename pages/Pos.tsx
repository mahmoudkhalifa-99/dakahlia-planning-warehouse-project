
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard, GlassButton, GlassInput } from '../components/NeumorphicUI';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Printer, ShoppingBag } from 'lucide-react';
import { dbService } from '../services/storage';
import { Sale, Product } from '../types';
import { printService } from '../services/printing';

export const Pos: React.FC = () => {
  const { products, cart, addToCart, updateCartQuantity, clearCart, settings, user, t } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Barcode Scanner Logic (Simple)
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus search on load
    inputRef.current?.focus();
  }, []);

  const handleBarcode = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const product = products.find(p => p.barcode === searchTerm || p.id === searchTerm);
      if (product) {
        addToCart(product);
        setSearchTerm('');
      }
    }
  };

  const filteredProducts = products.filter((p: Product) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode.includes(searchTerm);
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories: string[] = ['All', ...Array.from(new Set(products.map(p => p.category))) as string[]];

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * (settings.taxRate / 100);
  const total = subtotal + tax;

  const handleCheckout = (method: 'cash' | 'card') => {
    if (cart.length === 0) return;

    const sale: Sale = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(), // Track entry timestamp
      cashierId: user?.id || 'unknown',
      cashierName: user?.name || 'Unknown',
      items: [...cart],
      subtotal,
      tax,
      total,
      paymentMethod: method
    };

    dbService.saveSale(sale);
    
    // Print Receipt
    printService.printReceipt(sale, settings);
    
    clearCart();
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] gap-6 p-4">
      {/* Left: Product Grid */}
      <div className="flex-1 flex flex-col gap-6">
        <GlassCard className="py-4 px-6 flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute top-3.5 left-3 text-gray-400 w-5 h-5" />
            <input 
              ref={inputRef}
              type="text" 
              placeholder={t('search')} 
              className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl outline-none focus:bg-white focus:shadow-inner transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleBarcode}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-all ${
                  selectedCategory === cat 
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' 
                  : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </GlassCard>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pr-2">
          {filteredProducts.map(product => (
            <GlassCard 
              key={product.id} 
              className="p-4 flex flex-col gap-2 cursor-pointer hover:-translate-y-1 transition-transform border-2 border-transparent hover:border-blue-300"
              onClick={() => addToCart(product)}
            >
              <div className="h-32 bg-gray-100 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              </div>
              <h3 className="font-bold text-gray-800 truncate">{product.name}</h3>
              <div className="flex justify-between items-center mt-auto">
                <span className="text-blue-600 font-bold">{settings.currency} {product.price}</span>
                <span className="text-xs text-gray-400">Stock: {product.stock}</span>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Right: Cart */}
      <GlassCard className="w-96 flex flex-col h-full p-0 overflow-hidden">
        <div className="p-4 bg-white/50 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-700">Current Order</h2>
          <p className="text-sm text-gray-400">Transaction ID: #{Date.now().toString().slice(-6)}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
              <ShoppingBag size={48} />
              <p className="mt-2">Cart is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm">
                <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                   <img src={item.image} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-700 text-sm">{item.name}</h4>
                  <p className="text-blue-500 text-xs font-semibold">{settings.currency} {item.price * item.quantity}</p>
                </div>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <button 
                    onClick={() => updateCartQuantity(item.id, -1)}
                    className="p-1 hover:bg-white rounded shadow-sm transition-all"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => updateCartQuantity(item.id, 1)}
                    className="p-1 hover:bg-white rounded shadow-sm transition-all"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button 
                  onClick={() => updateCartQuantity(item.id, -item.quantity)}
                  className="text-red-400 hover:text-red-600 ml-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-white/80 border-t border-gray-100 backdrop-blur-md">
          <div className="flex justify-between mb-2 text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-bold">{settings.currency} {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mb-4 text-sm">
            <span className="text-gray-500">Tax ({settings.taxRate}%)</span>
            <span className="font-bold">{settings.currency} {tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mb-6 text-xl font-bold text-gray-800">
            <span>Total</span>
            <span>{settings.currency} {total.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <GlassButton 
              variant="default" 
              className="bg-green-100 text-green-700 hover:bg-green-200"
              onClick={() => handleCheckout('cash')}
            >
              <Banknote size={20} /> Cash
            </GlassButton>
            <GlassButton 
              variant="default" 
              className="bg-blue-100 text-blue-700 hover:bg-blue-200"
              onClick={() => handleCheckout('card')}
            >
              <CreditCard size={20} /> Card
            </GlassButton>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
