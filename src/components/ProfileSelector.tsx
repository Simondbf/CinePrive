import React from 'react';
import { User } from '../types';
import { motion } from 'motion/react';

interface Props {
  users: User[];
  onSelect: (user: User) => void;
}

export default function ProfileSelector({ users, onSelect }: Props) {
  return (
    <div className="flex flex-col items-center">
      <h2 className="text-2xl md:text-3xl font-medium mb-8 text-zinc-200">Qui est-ce ?</h2>
      <div className="flex flex-wrap items-center justify-center gap-8">
        {users.map((user, i) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex flex-col items-center group cursor-pointer"
            onClick={() => onSelect(user)}
          >
             {/* Profile Avatar */}
            <div className={`w-32 h-32 md:w-40 md:h-40 rounded flex items-center justify-center ${user.color} mb-4 shadow-xl ring-4 ring-transparent group-hover:ring-white transition-all transform group-hover:scale-105 duration-300`}>
                <span className="text-4xl md:text-6xl font-bold text-white drop-shadow-md">
                    {user.name.charAt(0)}
                </span>
            </div>
            
            <span className="text-zinc-400 group-hover:text-white text-lg font-medium transition-colors">
                {user.name}
            </span>
          </motion.div>
        ))}
      </div>
      
      <div className="mt-16">
        <button className="px-6 py-2 border border-zinc-500 text-zinc-400 hover:text-white hover:border-white transition-colors rounded text-sm tracking-wide uppercase">
          Gérer les profils
        </button>
      </div>
    </div>
  );
}
