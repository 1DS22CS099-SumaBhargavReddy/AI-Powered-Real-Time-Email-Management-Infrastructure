import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { EmailController } from '../controllers/email.controller';
import { authenticateToken } from '../middleware/auth.middleware';

export const createApiRoutes = (): Router => {
  const router = Router();

  // Authentication Routes
  router.post('/auth/signup', AuthController.signup);
  router.post('/auth/login', AuthController.login);
  router.get('/auth/me', authenticateToken, AuthController.me);

  // Email Retrieval & Search Routes
  router.get('/emails', authenticateToken, EmailController.getEmails);
  router.get('/emails/search', authenticateToken, EmailController.searchEmails);
  router.get('/emails/:id', authenticateToken, EmailController.getEmailById);

  // AI & RAG Routes
  router.post('/emails/:id/suggest-reply', authenticateToken, EmailController.suggestReply);
  router.post('/emails/:id/categorize', authenticateToken, EmailController.categorizeEmail);
  router.post('/emails/:id/summarize', authenticateToken, EmailController.summarizeEmail);
  router.post('/emails/:id/set-category', authenticateToken, EmailController.setCategory);

  router.post('/accounts/connect', authenticateToken, EmailController.connectAccount);
  router.get('/accounts', authenticateToken, EmailController.getConnectedAccounts);
  router.delete('/accounts/:id', authenticateToken, EmailController.disconnectAccount);

  return router;
};