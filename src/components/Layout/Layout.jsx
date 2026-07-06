import './Layout.css';
import { Navbar } from '../Navbar/Navbar';

export function Layout({ children }) {
  return (
    <div className="layout">
      <Navbar />
      <main className="layout-main">
        {children}
      </main>
    </div>
  );
}