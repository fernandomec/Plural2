const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
require('dotenv').config();

//express
const app = express();

//prisma client
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// EJS template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//multer
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'empresas');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const produtosUploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'produtos');
if (!fs.existsSync(produtosUploadsDir)){
    fs.mkdirSync(produtosUploadsDir, { recursive: true });
}

//middlewares
app.use(bodyParser.json()); //body parser
app.use(express.urlencoded({ extended: true }));//formularios
app.use(express.json()); //JSON
app.use(express.static(path.join(__dirname, '..', 'public')));//public
app.use(cookieParser());
const authMiddleware = require('./middleware/auth');//autenticação
const { checkUser } = require('./middleware/auth');
app.use(checkUser);

const iniciarLimpador = require('./utils/limparCarrinho');

const limpadorInterval = iniciarLimpador();

process.on('SIGTERM', () => {
    clearInterval(limpadorInterval);
    process.exit(0);
});

app.use(async (req, res, next) => {
  try {
    const empresas = await prisma.empresa.findMany({
      select: {
        id: true,
        razaoSocial: true,
      }
    });
    res.locals.empresas = empresas;
    next();
  } catch (error) {
    console.error('Error fetching empresas:', error);
    res.locals.empresas = [];
    next();
  }
});

// Rota para servir imagens diretamente do banco de dados
app.get('/image/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const imagem = await prisma.imagem.findUnique({
      where: { id }
    });
    
    if (!imagem) {
      return res.status(404).send('Imagem não encontrada');
    }
    
    res.setHeader('Content-Type', imagem.mimeType);
    res.send(imagem.data);
  } catch (error) {
    console.error('Erro ao buscar imagem:', error);
    res.status(500).send('Erro ao buscar imagem');
  }
});



//servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});

//rotas
const authenticationRoutes = require('./routes/authentication');
const adminRoutes = require('./routes/admin');
const lojaRoutes = require('./routes/loja');
const userRoutes = require('./routes/user');
const orderRoutes = require('./routes/order');
const authRoutes = require('./routes/auth');



app.use('/', authenticationRoutes);
app.use('/admin', adminRoutes);
app.use('/', lojaRoutes);
app.use('/', userRoutes);
app.use('/', orderRoutes);
app.use('/', authRoutes);

//home
app.get('/', async (req, res) => {
  try {
    const empresas = await prisma.empresa.findMany({
      include: {
        bannerImagem: true, //inclui os dados da imagem do banner
      },
    });
    res.render('home', { user: res.locals.user, empresas: empresas });
  } catch (error) {
    console.error('Erro ao buscar empresas:', error);
    res.render('home', { user: res.locals.user, empresas: [] });
  }
});

//sobre
app.get('/about', (req, res) => {
  res.render('about', { user: res.locals.user });
});

//contato
app.get('/contact', (req, res) => {
  res.render('contact', { user: res.locals.user });
});

//termos de uso
app.get('/politica-de-privacidade', (req, res) => {
    res.render('politica-de-privacidade', { user: req.user });
});

//404
app.use((req, res, next) => {
  res.status(404).render('404');
});

