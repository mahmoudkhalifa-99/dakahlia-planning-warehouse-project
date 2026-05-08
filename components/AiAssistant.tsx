
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GlassCard, GlassButton } from './NeumorphicUI';
import { useApp } from '../context/AppContext';
import { Sparkles, Send, X, Bot, MessageSquare, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/storage';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export const AiAssistant: React.FC = () => {
  const { settings, t } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: 'Hello! I am your GlassPOS Assistant. Ask me about your inventory, sales, expenses or any product details.', timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const generateContext = () => {
    const products = dbService.getProducts();
    const sales = dbService.getSales();
    const expenses = dbService.getExpenses();
    const today = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter(s => s.date && s.date.startsWith(today));
    const todayExpenses = expenses.filter(e => e.date && e.date.startsWith(today));
    
    // Summarize data to save tokens
    const productSummary = products.slice(0, 50).map(p => 
      `${p.name} (Stock: ${p.stock} ${p.unit}, Price: ${p.price}, Warehouse: ${p.warehouse})`
    ).join('\n');

    const salesStats = {
      totalRevenueToday: todaySales.reduce((sum, s) => sum + s.total, 0),
      totalExpensesToday: todayExpenses.reduce((sum, e) => sum + e.amount, 0),
      transactionCount: todaySales.length,
    };

    return `
      Current System Data:
      Currency: ${settings.currency}
      Today's Date: ${today}
      
      Today Summary:
      Total Revenue: ${salesStats.totalRevenueToday}
      Total Expenses: ${salesStats.totalExpensesToday}
      Net for Today: ${salesStats.totalRevenueToday - salesStats.totalExpensesToday}
      Transactions: ${salesStats.transactionCount}
      
      Inventory Snapshot (Top 50 items):
      ${productSummary}
    `;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Check if API key is selected if it's a paid model or if the environment requires it
      // This is specific to AI Studio environment
      if (typeof window !== 'undefined' && (window as any).aistudio && !(await (window as any).aistudio.hasSelectedApiKey())) {
        await (window as any).aistudio.openSelectKey();
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API Key is missing. Please configure GEMINI_API_KEY in your environment variables.");
      }

      const ai = new GoogleGenAI({ apiKey: apiKey });
      const contextData = generateContext();
      
      const systemInstruction = `
        You are the intelligent assistant for the GlassPOS system (Dakahlya Warehouse System). 
        You have access to the store's current inventory, sales and financial expenses data provided below.
        Answer the user's questions concisely and helpfully based ONLY on this data.
        If asked about financial status, consider both sales and expenses.
        Be polite and professional.
        
        ${contextData}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: input,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2, 
        },
      });

      const text = response.text || "I couldn't generate a response. Please check the system logs.";
      
      const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: text, timestamp: new Date() };
      setMessages(prev => [...prev, botMsg]);

    } catch (error) {
      console.error("Gemini API Error:", error);
      const errorMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: "Sorry, I encountered an error connecting to the AI service. Please check your internet connection or API key.", 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full shadow-lg shadow-blue-500/40 text-white flex items-center justify-center border-2 border-white/20"
      >
        {isOpen ? <X size={24} /> : <Sparkles size={24} />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-full max-w-sm"
          >
            <GlassCard className="h-[500px] flex flex-col p-0 overflow-hidden border border-white/50 shadow-2xl bg-white/80 backdrop-blur-xl">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex items-center gap-3 shadow-sm">
                <div className="bg-white/20 p-2 rounded-full">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm font-cairo">GlassPOS AI</h3>
                  <p className="text-[10px] text-blue-100 opacity-80">Powered by Gemini 3</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`
                        max-w-[80%] p-3 rounded-2xl text-sm shadow-sm
                        ${msg.role === 'user' 
                          ? 'bg-blue-600 text-white rounded-br-none' 
                          : 'bg-white text-gray-700 rounded-bl-none border border-gray-100'}
                      `}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-gray-100 shadow-sm flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-blue-600" />
                      <span className="text-xs text-gray-500">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 bg-white border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-gray-100 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ask about sales, stock or expenses..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
