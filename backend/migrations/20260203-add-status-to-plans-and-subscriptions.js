'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('tenants', 'plan', { type: Sequelize.STRING(128), allowNull: true });
    await queryInterface.addColumn('plans', 'status', { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'ACTIVE' });
    await queryInterface.addColumn('subscriptions', 'status', { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'ACTIVE' });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('tenants', 'plan');
    await queryInterface.removeColumn('plans', 'status');
    await queryInterface.removeColumn('subscriptions', 'status');
  }
};
