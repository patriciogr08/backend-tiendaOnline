import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();


import { errorHandler } from './middleware/errorHandler.js';


import healthRoutes from './routes/health.routes.js';
import setupRoutes from './routes/setup.routes.js';
import authRoutes from './routes/auth.routes.js';
import productsRoutes from './routes/products.routes.js';




const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/health', healthRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));
app.use(errorHandler);

