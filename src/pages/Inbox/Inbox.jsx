import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { InfoSourceCard } from '../../components/InfoSourceCard/InfoSourceCard';
import { DetailDrawer } from '../../components/DetailDrawer/DetailDrawer';
import { inboxItems } from '../../mock/inboxData';
import './Inbox.css';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export function Inbox() {
  const [filter, setFilter] = useState('All');
  const [selectedItem, setSelectedItem] = useState(null);

  const filteredItems = filter === 'All' ? inboxItems : inboxItems.filter(item => item.platform === filter);

  return (
    <div className="inbox">
      <header className="inbox-header">
        <h1>捕获箱 (Inbox)</h1>
        <div className="inbox-filters">
          {['All', 'Bilibili', 'Zhihu', 'Podcast'].map(f => (
            <button 
              key={f} 
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <motion.div 
        className="inbox-grid"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {filteredItems.map(item => (
          <motion.div key={item.id} variants={itemVariants}>
            <InfoSourceCard data={item} onClick={() => setSelectedItem(item)} />
          </motion.div>
        ))}
      </motion.div>

      <DetailDrawer 
        isOpen={!!selectedItem} 
        onClose={() => setSelectedItem(null)} 
        data={selectedItem}
      />
    </div>
  );
}
