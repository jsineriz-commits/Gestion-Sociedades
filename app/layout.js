import './globals.css';

export const metadata = {
  title: 'Funnel Comercial - DCAC',
  description: 'Buscador de prospectos y embudo de amarillas',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
