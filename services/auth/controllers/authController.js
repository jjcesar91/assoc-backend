const { User } = require('../models');
const jwt = require('jsonwebtoken');

const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET || 'your_refresh_secret',
        { expiresIn: '7d' }
    );
    return { accessToken, refreshToken };
};

exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const user = await User.create({ username, email, password });
        const tokens = generateTokens(user);
        res.json({ user: { id: user.id, username: user.username, email: user.email }, ...tokens });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`Login attempt for: ${email}`);
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
            console.log('User not found');
            return res.status(401).json({ error: 'User not found' }); // DEV: specific message
        }

        const isValid = await user.validatePassword(password);
        if (!isValid) {
            console.log('Password invalid');
            // DEV: return hash for debugging if really needed, but let's just say invalid password
            return res.status(401).json({ error: 'Invalid password' }); // DEV: specific message
        }

        const tokens = generateTokens(user);
        res.json({ user: { id: user.id, username: user.username, role: user.role }, ...tokens });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.refreshToken = async (req, res) => {
    const { token } = req.body;
    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'your_refresh_secret', async (err, decoded) => {
        if (err) return res.sendStatus(403);
        
        const user = await User.findByPk(decoded.id);
        if (!user) return res.sendStatus(403);

        const tokens = generateTokens(user);
        res.json(tokens);
    });
};

exports.me = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password'] }
        });
        if (!user) return res.sendStatus(404);
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

exports.updateProfile = async (req, res) => {
    try {
        const { nome, cognome, email, telefono } = req.body;
        const user = await User.findByPk(req.user.id);
        
        if (!user) return res.sendStatus(404);

        if (email && email !== user.email) {
            const exists = await User.findOne({ where: { email } });
            if (exists) return res.status(400).json({ error: 'Email already in use' });
        }

        user.nome = nome || user.nome;
        user.cognome = cognome || user.cognome;
        user.email = email || user.email;
        user.telefono = telefono || user.telefono;
        
        await user.save();
        
        res.json({ 
            message: 'Profile updated successfully',
            user: { 
                id: user.id, 
                username: user.username, 
                email: user.email,
                nome: user.nome,
                cognome: user.cognome,
                telefono: user.telefono
            } 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findByPk(req.user.id);
        
        if (!user) return res.sendStatus(404);

        if (!(await user.validatePassword(oldPassword))) {
            return res.status(400).json({ error: 'Invalid old password' });
        }

        user.password = newPassword; // Will be hashed by beforeUpdate hook
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
