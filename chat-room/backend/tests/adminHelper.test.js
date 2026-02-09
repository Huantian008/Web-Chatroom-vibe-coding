const adminHelper = require('../utils/adminHelper');

describe('Admin Helper', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('isAdmin', () => {
        it('should return true for admin users', () => {
            const result = adminHelper.isAdmin('admin');
            expect(result).toBe(true);
        });

        it('should return false for non-admin users', () => {
            const result = adminHelper.isAdmin('testuser');
            expect(result).toBe(false);
        });
    });

    describe('getAdminList', () => {
        it('should return array of admin usernames', () => {
            const admins = adminHelper.getAdminList();
            expect(Array.isArray(admins)).toBe(true);
        });
    });
});
