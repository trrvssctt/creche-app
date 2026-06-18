'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('leaves', 'document_url', {
      type: Sequelize.STRING,
      allowNull: true
    });
    
    await queryInterface.addColumn('leaves', 'document_name', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('leaves', 'document_url');
    await queryInterface.removeColumn('leaves', 'document_name');
  }
};