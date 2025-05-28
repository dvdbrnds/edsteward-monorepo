'use client';

import React from 'react';
import { StyleSheetManager } from 'styled-components';

export default function StyledComponentsRegistry({ children }) {
  // For Vite/client-side only apps, we don't need SSR styled-components handling
  // Just return the children wrapped in StyleSheetManager for consistent styling
  if (typeof window !== 'undefined') {
    return <>{children}</>;
  }

  // Fallback for any SSR scenarios (though we're using Vite)
  return <>{children}</>;
} 