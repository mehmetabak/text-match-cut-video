// src/components/Header.jsx
import React from 'react';

function Header() {
  return (
    <header className="text-center mb-8">
      <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 sm:text-5xl">
        Video Match Cut
      </h1>
      <p className="mt-3 max-w-md mx-auto text-base text-gray-400 sm:text-lg md:mt-4 md:text-xl md:max-w-3xl">
        Bir kelime grubu girerek saniyeler içinde sinematik video geçişleri oluşturun.
      </p>
    </header>
  );
}

export default Header;