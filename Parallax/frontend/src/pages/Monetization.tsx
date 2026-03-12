import { Wallet, Briefcase, Mail, ArrowRight } from 'lucide-react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import './Monetization.css';

export default function Monetization() {
  const { scrollY } = useScroll();
  const smoothScrollY = useSpring(scrollY, { stiffness: 300, damping: 30 });
  const headerScale = useTransform(smoothScrollY, [0, 100], [1, 0.75]);
  const headerOpacity = useTransform(smoothScrollY, [0, 100], [1, 0]);

  return (
    <div className="monetize-container">
      <header className="page-header" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <motion.div style={{ scale: headerScale, transformOrigin: 'top left' }}>
          <h1 className="page-title dot-display"><span className="typography-reveal"><span>Creator Hub</span></span></h1>
          <motion.p className="body-medium text-muted" style={{ opacity: headerOpacity, overflow: 'hidden', margin: 0 }}>
            Earn with a small following.
          </motion.p>
        </motion.div>
      </header>

      <motion.div 
        className="finance-dashboard"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
      >
        <motion.div 
          className="balance-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
        >
          <div className="balance-header">
            <span className="body-medium">Estimated Earnings</span>
            <Wallet size={18} />
          </div>
          <div className="balance-amount">₹ 0</div>
          <div className="balance-footer">
            <span className="badge-light body-small">Fresh Start</span>
            <button className="withdraw-btn body-small" disabled style={{ opacity: 0.5 }}>Withdraw <ArrowRight size={12} /></button>
          </div>
        </motion.div>

        <motion.div 
          className="opportunities-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
        >
          <div className="section-title">
            <Briefcase size={18} className="text-primary" />
            <h3 className="title-large">UPI-Integrated Deals</h3>
          </div>
          
          <div className="deals-list">
            <div style={{ textAlign: 'center', padding: 'var(--space-24)', color: 'var(--n-on-surface-muted)', border: '1px dashed var(--n-outline)', borderRadius: 'var(--radius-md)' }}>
              <p className="body-medium">No brand deals currently available for your profile size. Keep growing!</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          className="pitch-generator"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
        >
          <div className="pitch-header">
            <Mail size={20} className="text-primary" />
            <div style={{ marginLeft: 'var(--space-12)' }}>
              <h3 className="title-medium">Smart Brand Pitch</h3>
              <p className="body-small text-muted">AI-crafted proposals for local stores</p>
            </div>
          </div>
          
          <div className="pitch-form">
            <input type="text" className="brand-input body-medium" placeholder="E.g., Ramesh Electronics Hub" />
            <button className="generate-pitch-btn">
              Generate Pitch Template
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
