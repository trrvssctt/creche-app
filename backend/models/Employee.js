import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Employee extends Model {}

Employee.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
  firstName: { type: DataTypes.STRING, allowNull: false, field: 'first_name' },
  lastName: { type: DataTypes.STRING, allowNull: false, field: 'last_name' },
  email: { type: DataTypes.STRING, unique: true },
  phone: { type: DataTypes.STRING },
  birthDate: { type: DataTypes.DATE, field: 'birth_date' },
  gender: { type: DataTypes.ENUM('M', 'F', 'O'), field: 'gender' },
  address: { type: DataTypes.TEXT },
  city: { type: DataTypes.STRING },
  country: { type: DataTypes.STRING, defaultValue: 'Sénégal' },
  departmentId: { type: DataTypes.UUID, field: 'department_id' },
  position: { type: DataTypes.STRING },
  managerId: { type: DataTypes.UUID, field: 'manager_id' },
  hireDate: { type: DataTypes.DATE, field: 'hire_date' },
  status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED'), defaultValue: 'ACTIVE' },
  baseSalary: { type: DataTypes.DECIMAL, field: 'base_salary' },
  bankInfo: { type: DataTypes.JSONB, field: 'bank_info' },
  contractType: { type: DataTypes.STRING, field: 'contract_type' }, // Kept for backward compatibility
  photoUrl: { type: DataTypes.STRING, field: 'photo_url' },
  meta: { type: DataTypes.JSONB, allowNull: true }
}, {
  sequelize,
  modelName: 'employee',
  tableName: 'employees',
  underscored: true
});

export default Employee;
