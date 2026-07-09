import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { InfoSourceCard } from '../../components/InfoSourceCard/InfoSourceCard';
import { DetailDrawer } from '../../components/DetailDrawer/DetailDrawer';
import { useInboxItems } from '../../hooks/useInboxItems';
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
  const { items, setItems, togglePremium, saveNote, updateItem } = useInboxItems();
  const [selectedItem, setSelectedItem] = useState(null);
  const [draftNote, setDraftNote] = useState('');
  const [draftTags, setDraftTags] = useState([]);

  const filteredItems = filter === 'All' ? items : items.filter(item => item.platform === filter);
  const premiumCount = items.filter(i => i.hasNote).length;

  const openDrawer = (item) => {
    setSelectedItem(item);
    setDraftNote(item.note || '');
    setDraftTags(item.tags || []);
    if (!item.opened) {
      updateItem(item.id, { opened: true });
    }
  };

  const toggleTag = (tag) => {
    setDraftTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleCloseDrawer = () => {
    if (selectedItem) {
      updateItem(selectedItem.id, { note: draftNote, tags: draftTags });
    }
    setSelectedItem(null);
  };

  const handleUpgrade = () => {
    if (!selectedItem) return;
    saveNote(selectedItem.id, draftNote, draftTags);
    setSelectedItem(null);
  };

  const handleTogglePremium = (id) => {
    togglePremium(id);
  };

  const getPremiumLabel = (item) => {
    return '优质信息源';
  };

  return (
    <div className="inbox">
      <header className="inbox-header">
        <h1>捕获箱 (Inbox)</h1>
        <div className="inbox-subtitle">
          共 <strong>{premiumCount}</strong> 条优质信息源
        </div>
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
            <InfoSourceCard
              data={item}
              isPremium={item.hasNote}
              premiumLabel={getPremiumLabel(item)}
              onTogglePremium={handleTogglePremium}
              onClick={() => openDrawer(item)}
            />
          </motion.div>
        ))}
      </motion.div>

      <DetailDrawer
        isOpen={!!selectedItem}
        onClose={handleCloseDrawer}
        data={selectedItem}
        draftNote={draftNote}
        draftTags={draftTags}
        onNoteChange={setDraftNote}
        onToggleTag={toggleTag}
        onUpgrade={handleUpgrade}
        onTogglePremium={(id) => {
          handleTogglePremium(id);
          setSelectedItem(null);
        }}
        sourceTitle={selectedItem?.title}
      />
    </div>
  );
}
