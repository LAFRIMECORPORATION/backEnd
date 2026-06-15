import { Router } from 'express';
const router = Router();
router.get('/placeholder', (req, res) => res.json({ message: "KYC en attente" }));
export default router;