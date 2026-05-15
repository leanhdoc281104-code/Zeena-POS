import knex from 'knex';
import path from 'path';

const db = knex({
  client: 'better-sqlite3',
  connection: {
    filename: path.join(process.cwd(), 'database.sqlite'),
  },
  useNullAsDefault: true,
});

export async function initDb() {
  if (!(await db.schema.hasTable('users'))) {
    await db.schema.createTable('users', (table) => {
      table.string('id').primary();
      table.string('name');
      table.string('email').unique();
      table.string('password'); // Added for local auth
      table.string('role');
      table.timestamp('createdAt').defaultTo(db.fn.now());
    });
  } else {
    // Migration: ensure 'id' column exists. If 'uid' exists, rename it to 'id'
    const hasId = await db.schema.hasColumn('users', 'id');
    const hasUid = await db.schema.hasColumn('users', 'uid');
    
    if (!hasId && hasUid) {
      await db.schema.alterTable('users', (table) => {
        table.renameColumn('uid', 'id');
      });
    } else if (!hasId) {
      await db.schema.alterTable('users', (table) => {
        table.string('id').primary();
      });
    }
  }

  if (!(await db.schema.hasTable('products'))) {
    await db.schema.createTable('products', (table) => {
      table.string('id').primary();
      table.string('name');
      table.string('barcode');
      table.float('price');
      table.float('cost');
      table.float('stock');
      table.float('minStock');
      table.string('unit');
      table.string('category');
      table.string('expiryDate');
      table.string('imageUrl');
      table.timestamp('createdAt').defaultTo(db.fn.now());
      table.timestamp('updatedAt').defaultTo(db.fn.now());
    });
  }

  if (!(await db.schema.hasTable('sales'))) {
    await db.schema.createTable('sales', (table) => {
      table.string('id').primary();
      table.text('items'); // JSON stringified
      table.float('total');
      table.float('profit');
      table.float('discount').defaultTo(0);
      table.string('paymentMethod');
      table.string('receiptUrl');
      table.string('date');
      table.string('cashierId');
      table.string('customerId');
      table.timestamp('createdAt').defaultTo(db.fn.now());
    });
  }

  if (!(await db.schema.hasTable('expenses'))) {
    await db.schema.createTable('expenses', (table) => {
      table.string('id').primary();
      table.string('description');
      table.float('amount');
      table.string('date');
      table.string('category');
      table.string('recordedBy');
      table.timestamp('createdAt').defaultTo(db.fn.now());
    });
  }

  if (!(await db.schema.hasTable('purchases'))) {
    await db.schema.createTable('purchases', (table) => {
      table.string('id').primary();
      table.string('supplierName');
      table.text('items'); // JSON stringified
      table.float('total');
      table.string('date');
      table.string('recordedBy');
      table.timestamp('createdAt').defaultTo(db.fn.now());
    });
  }

  if (!(await db.schema.hasTable('customers'))) {
    await db.schema.createTable('customers', (table) => {
      table.string('id').primary();
      table.string('name');
      table.string('phone');
      table.float('debtBalance').defaultTo(0);
      table.timestamp('createdAt').defaultTo(db.fn.now());
      table.timestamp('updatedAt').defaultTo(db.fn.now());
    });
  }

  if (!(await db.schema.hasTable('settings'))) {
    await db.schema.createTable('settings', (table) => {
      table.string('id').primary();
      table.text('value'); // JSON stringified
    });
  }

  // Manufacturing tables
  if (!(await db.schema.hasTable('manufacturing_cycles'))) {
    await db.schema.createTable('manufacturing_cycles', (table) => {
      table.string('id').primary();
      table.string('productName');
      table.float('fundingAmount');
      table.float('manufacturingCost');
      table.integer('cartonsProduced');
      table.float('cartonPrice');
      table.string('status');
      table.string('startDate');
      table.timestamp('createdAt').defaultTo(db.fn.now());
      table.timestamp('updatedAt').defaultTo(db.fn.now());
    });
  } else {
    const hasStartDate = await db.schema.hasColumn('manufacturing_cycles', 'startDate');
    if (!hasStartDate) {
      await db.schema.alterTable('manufacturing_cycles', (table) => {
        table.string('startDate');
      });
    }
  }

  if (!(await db.schema.hasTable('manufacturing_sales'))) {
    await db.schema.createTable('manufacturing_sales', (table) => {
      table.string('id').primary();
      table.string('cycleId');
      table.string('customerName');
      table.string('customerPhone');
      table.integer('cartonsSold');
      table.float('totalAmount');
      table.string('date');
      table.string('recordedBy');
      table.timestamp('createdAt').defaultTo(db.fn.now());
    });
  }

  if (!(await db.schema.hasTable('manufacturing_expenses'))) {
    await db.schema.createTable('manufacturing_expenses', (table) => {
      table.string('id').primary();
      table.string('cycleId');
      table.string('description');
      table.float('amount');
      table.string('date');
      table.string('recordedBy');
      table.timestamp('createdAt').defaultTo(db.fn.now());
    });
  }
}

export default db;
