// navigationRef.js
import { createRef } from 'react';

export const CaregivernavigationRef = createRef();

export function navigate(name, params) {
  if (navigationRef.current) {
    navigationRef.current.navigate(name, params);
  }
}