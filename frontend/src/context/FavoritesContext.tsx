import React, { createContext, useContext, useState, useEffect } from 'react';
import { message } from 'antd';

interface FavoriteProblem {
  id: string;
  slug: string;
  title: string;
  addedAt: string;
}

interface FavoritesContextType {
  favorites: FavoriteProblem[];
  addFavorite: (problem: { id: string; slug: string; title: string }) => void;
  removeFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (problem: { id: string; slug: string; title: string }) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<FavoriteProblem[]>(() => {
    const saved = localStorage.getItem('leetcode-dashboard-favorites');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('leetcode-dashboard-favorites', JSON.stringify(favorites));
  }, [favorites]);

  const addFavorite = (problem: { id: string; slug: string; title: string }) => {
    if (favorites.some(f => f.id === problem.id)) {
      message.info('Already in favorites');
      return;
    }
    
    const newFavorite: FavoriteProblem = {
      ...problem,
      addedAt: new Date().toISOString(),
    };
    
    setFavorites(prev => [...prev, newFavorite]);
    message.success('Added to favorites');
  };

  const removeFavorite = (id: string) => {
    setFavorites(prev => prev.filter(f => f.id !== id));
    message.success('Removed from favorites');
  };

  const isFavorite = (id: string) => {
    return favorites.some(f => f.id === id);
  };

  const toggleFavorite = (problem: { id: string; slug: string; title: string }) => {
    if (isFavorite(problem.id)) {
      removeFavorite(problem.id);
    } else {
      addFavorite(problem);
    }
  };

  return (
    <FavoritesContext.Provider value={{ favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }
  return context;
};
