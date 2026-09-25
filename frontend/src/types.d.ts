/// <reference types="vite/client" />

declare module 'leaflet-draw';

declare namespace google {
  namespace accounts {
    namespace id {
      function initialize(options: any): void;
      function prompt(callback?: (notification: any) => void): void;
      function renderButton(parent: HTMLElement, options: any): void;
    }
  }
}
