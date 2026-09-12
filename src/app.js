require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');

const config = require('./config');
const { attachUser } = require('./middleware/auth');

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

app.use(
  helmet({
    hsts: false,
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https://*.supabase.co", "https://www.gstatic.com"],
        connectSrc: ["'self'", "https://*.supabase.co"],
      },
    },
  )
);

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, 'views'));

app.use(expressLayouts);

app.set('layout', 'layouts/customer');


app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use(cookieParser());


app.use(
    express.static(
        path.join(__dirname, '..', 'public')
    )
);


app.use(attachUser);


const money = require('./utils/money');

app.use((req, res, next) => {
    res.locals.formatPeso = money.formatPeso;
    res.locals.formatPlain = money.formatPlain;
    res.locals.currentPath = req.path;

    next();
});



app.get('/health', (req, res) => {
    res.json({
        ok: true,
        env: config.env
    });
});


app.use('/', require('./routes/auth'));

app.use('/admin', require('./routes/admin'));

app.use("/",generalLimiter, require("./routes/customer"));


app.use((req, res) => {
    res.status(404).render('customer/error', {
        title: 'Not found',
        status: 404,
        message: 'That page does not exist.'
    });
});



app.use((err, req, res, next) => {
    console.error('[error]', err);

    res.status(500).render('customer/error', {
        title: 'Something went wrong',
        status: 500,
        message:
            config.env === 'development'
                ? err.message
                : 'Something went wrong on our end. Please try again.'
    });
});

module.exports = app;