import { Link } from 'react-router-dom';
import './Navbar.css';

export function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="brand-link">
          <h1>InfoDigest</h1>
        </Link>
      </div>
      <ul className="navbar-menu">
        <li><Link to="/">首页</Link></li>
        <li><Link to="/about">关于</Link></li>
        <li><Link to="/contact">联系</Link></li>
        <li><Link to="/user" className="user-btn">用户</Link></li>
      </ul>
    </nav>
  );
}