import { db } from "../config/db.js";
import { user, farmer_profile, farms, cultivation } from "../src/db/schema.js";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import { validationResult } from "express-validator";
import { generateToken } from "../utils/jwt.js";

const sanitizeUser = (userInstance) => {
  const { password_hash, ...userWithoutPassword } = userInstance;
  return userWithoutPassword;
};

export const registerFarmer = async (req, res) => {
  const { name, email, password, phone, nic, address, gender, date_of_birth } =
    req.body;

  try {
    // Check if user already exists before starting transaction
    const userExists = await db
      .select()
      .from(user)
      .where(eq(user.email, email));
    if (userExists.length > 0) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const result = await db.transaction(async (tx) => {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      const newUser = await tx
        .insert(user)
        .values({
          name,
          email,
          password_hash,
          phone,
          role_id: 1, // farmer role
          status: "active",
        })
        .returning();

      await tx.insert(farmer_profile).values({
        user_id: newUser[0].user_id,
        nic,
        address,
        gender,
        date_of_birth,
      });

      return newUser[0];
    });

    const sanitizedUser = sanitizeUser(result);

    res.status(201).json({
      success: true,
      message: "Farmer registered successfully",
      user: sanitizedUser,
      token: generateToken(result.user_id),
    });
  } catch (error) {
    console.error("Error registering farmer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to register farmer",
      error: error.message,
    });
  }
};

export const loginFarmer = async (req, res) => {
  const { email, password } = req.body;

  try {
    const users = await db.select().from(user).where(eq(user.email, email));
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const userInstance = users[0];

    if (userInstance.role_id !== 1) {
      return res.status(403).json({
        success: false,
        message: "Not authorized as a farmer",
      });
    }

    const isMatch = await bcrypt.compare(password, userInstance.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const sanitizedUser = sanitizeUser(userInstance);

    res.json({
      success: true,
      message: "Login successful",
      user: sanitizedUser,
      token: generateToken(userInstance.user_id),
    });
  } catch (error) {
    console.error("Error logging in farmer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to login farmer",
      error: error.message,
    });
  }
};

export const createFarm = async (req, res) => {
  try {
    // Verify user is a farmer (handle both string and number types). Needed when debugging.
    const userRoleId = Number(req.user.role_id);

    if (isNaN(userRoleId) || userRoleId !== 1) {
      console.error("Role check failed:", {
        role_id: req.user.role_id,
        type: typeof req.user.role_id,
        converted: userRoleId,
        user_id: req.user.user_id,
      });
      return res.status(403).json({
        success: false,
        message:
          "Only farmers can create farms. Please ensure you logged in as a farmer.",
      });
    }

    // Get farmer_id from farmer_profile using user_id
    const farmerProfiles = await db
      .select()
      .from(farmer_profile)
      .where(eq(farmer_profile.user_id, req.user.user_id));

    if (farmerProfiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Farmer profile not found",
      });
    }

    const farmerId = farmerProfiles[0].farmer_id;
    const { farm_name, gps_coordinates, area_acres } = req.body;

    // Create farm record
    // Note: created_at and updated_at are handled by database defaults
    const newFarm = await db
      .insert(farms)
      .values({
        farmer_id: farmerId,
        farm_name,
        gps_coordinates,
        area_acres: parseFloat(area_acres),
      })
      .returning();

    res.status(201).json({
      success: true,
      message: "Farm created successfully",
      farm: newFarm[0],
    });
  } catch (error) {
    console.error("Error creating farm:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create farm",
      error: error.message,
    });
  }
};

export const createCultivation = async (req, res) => {
  try {
    // Verify user is a farmer (handle both string and number types). Needed when debugging.
    const userRoleId = Number(req.user.role_id);

    if (isNaN(userRoleId) || userRoleId !== 1) {
      console.error("Role check failed:", {
        role_id: req.user.role_id,
        type: typeof req.user.role_id,
        converted: userRoleId,
        user_id: req.user.user_id,
      });
      return res.status(403).json({
        success: false,
        message:
          "Only farmers can create cultivation records. Please ensure you logged in as a farmer.",
      });
    }

    const farmerProfiles = await db
      .select()
      .from(farmer_profile)
      .where(eq(farmer_profile.user_id, req.user.user_id));

    if (farmerProfiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Farmer profile not found",
      });
    }

    const farmerId = farmerProfiles[0].farmer_id;
    const {
      farm_id,
      date_of_planting,
      seeding_source,
      type_of_fertilizer,
      pesticides,
      organic_certification,
      expected_harvest_date,
      no_of_trees,
    } = req.body;

    // Verify that the farm belongs to this farmer
    const farmRecords = await db
      .select()
      .from(farms)
      .where(
        and(eq(farms.farm_id, parseInt(farm_id)), eq(farms.farmer_id, farmerId))
      );

    if (farmRecords.length === 0) {
      return res.status(403).json({
        success: false,
        message:
          "Farm not found or you do not have permission to create cultivation for this farm",
      });
    }

    // Create cultivation record
    // Note: created_at and updated_at are handled by database defaults
    const newCultivation = await db
      .insert(cultivation)
      .values({
        farm_id: parseInt(farm_id),
        farmer_id: farmerId,
        date_of_planting,
        seeding_source,
        type_of_fertilizer,
        pesticides,
        organic_certification,
        expected_harvest_date,
        no_of_trees: parseInt(no_of_trees),
      })
      .returning();

    res.status(201).json({
      success: true,
      message: "Cultivation record created successfully",
      cultivation: newCultivation[0],
    });
  } catch (error) {
    console.error("Error creating cultivation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create cultivation record",
      error: error.message,
    });
  }
};
