# MRV System Frontend

React + Vite frontend for the MRV (Monitoring, Reporting & Verification) System.

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## 📁 Project Structure

```
src/
├── api/           # Legacy API calls
├── assets/        # Static assets
├── components/    # Reusable components
├── contexts/      # React contexts (Auth)
├── layouts/       # Page layouts
├── pages/        # Page components
│   ├── analyst/      # Analyst dashboard
│   ├── auth/        # Login/Register
│   ├── operator/     # Operator forms
│   └── verification/ # Verification workflow
├── services/     # API service layer
└── utils/        # Utility functions
```

## 🎨 Styling

- Tailwind CSS for styling
- Custom dark theme with cyan/orange accents

## 🔌 API Integration

All API calls go through `services/api.js` which provides:
- JWT token authentication
- Automatic token refresh
- Error handling
