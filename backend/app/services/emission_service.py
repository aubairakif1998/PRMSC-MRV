"""
Emission Reduction Calculation Engine
======================================

WHY put business logic in a service layer instead of API routes?
  - Routes handle HTTP (receiving requests, sending responses).
  - Services handle BUSINESS LOGIC (the actual math and rules).
  - If you change the formula, you only touch this file — not 10 different routes.
  - Services can be called from multiple routes or tested independently.
  - This is called the "separation of concerns" principle.

  Before:  Route → Database query + math + save = messy
  After:   Route → calls EmissionService → clean and testable

EXCEL FORMULA → PYTHON CONVERSION:
  Excel: =B2*0.45                    Python: water_kwh * GRID_EMISSION_FACTOR
  Excel: =SUM(C2:C13)                Python: sum(monthly_values)
  Excel: =IF(A2>0, B2-C2, 0)        Python: max(0, baseline - project)

THE CORE MRV EQUATION:
  Emission Reduction = Baseline Emissions − Project Emissions

  Baseline = what emissions WOULD have been WITHOUT the solar project
             (all pumping done using dirty grid electricity)

  Project  = what emissions ARE with the solar project
             (pumping using solar + remaining grid electricity)

  Reduction = the climate benefit = how many kg CO₂ were AVOIDED
"""

from datetime import datetime

# ─────────────────────────────────────────────────────────────────
# EMISSION FACTORS
# These convert energy units into carbon emissions.
# Source: NEPRA / IPCC / Gold Standard MRV methodology
#
# How emission factors work (Excel analogy):
#   If you burn 1 kWh of Pakistan grid electricity →
#   Pakistan's grid mix (coal 33%, gas 40%, hydro 27%) →
#   emits on average 0.45 kg of CO₂
#
#   So: 100 kWh × 0.45 kg/kWh = 45 kg CO₂  (= 0.045 tCO₂)
# ─────────────────────────────────────────────────────────────────

# Pakistan National Grid emission factor (kg CO₂ per kWh)
# Source: NEPRA State of Industry Report / IPCC AR6
PAKISTAN_GRID_EF = 0.45     # kg CO₂e per kWh consumed

# Solar energy does NOT emit any CO₂ during operation
SOLAR_EMISSION_FACTOR = 0.0  # kg CO₂e per kWh generated

# Default pump power rating (kW) if not recorded in the system info
DEFAULT_PUMP_POWER_KW = 7.5  # Typical submersible tube well pump in Pakistan

# Conversion constant
KG_TO_TONNES = 0.001  # 1 kg = 0.001 metric tonnes (tCO₂)


# ─────────────────────────────────────────────────────────────────
# STEP 4: CALCULATE WATER PUMPING ENERGY CONSUMPTION
# ─────────────────────────────────────────────────────────────────

def calculate_pump_energy_kwh(pump_operating_hours: float, pump_power_kw: float = None) -> float:
    """
    Estimates electricity consumed by a water pump.

    Excel equivalent:
      =C2 * D2  (hours × power rating)

    Formula:
      Energy (kWh) = Pump Operating Hours × Pump Power Rating (kW)

    Example:
      Pump runs 200 hours per month at 7.5 kW
      Energy = 200 × 7.5 = 1,500 kWh

    Why hours × kilowatts = kilowatt-hours?
      Kilowatt-hour (kWh) is energy.
      Kilowatt (kW) is power (rate of energy use).
      If you use 1 kW for 1 hour → you used 1 kWh.
      A 7.5 kW pump running 200 hours → 1,500 kWh consumed.

    Args:
        pump_operating_hours: Total hours pump ran in the period
        pump_power_kw: Power rating of the pump in kW (default 7.5 kW)

    Returns:
        Energy in kWh (kilowatt-hours)
    """
    if pump_operating_hours is None or pump_operating_hours <= 0:
        return 0.0
    power = pump_power_kw if pump_power_kw else DEFAULT_PUMP_POWER_KW
    return float(pump_operating_hours) * float(power)


# ─────────────────────────────────────────────────────────────────
# STEP 5: CALCULATE BASELINE EMISSIONS
# ─────────────────────────────────────────────────────────────────

def calculate_baseline_emissions(energy_kwh: float, emission_factor: float = PAKISTAN_GRID_EF) -> float:
    """
    Calculates what emissions WOULD have been WITHOUT solar (baseline scenario).

    Scenario: The pump runs entirely on grid electricity (pre-project state).
    This is the "counterfactual" — what would happen if we never installed solar.

    Excel equivalent:
      =E2 * $B$1   (energy_kwh × emission_factor)
      where $B$1 is the fixed emission factor cell

    Formula:
      Baseline Emissions (kg CO₂) = Energy Consumption (kWh) × Grid Emission Factor (kg/kWh)

    Example:
      Annual pump energy = 18,000 kWh
      Grid emission factor = 0.45 kg CO₂/kWh
      Baseline Emissions = 18,000 × 0.45 = 8,100 kg CO₂ = 8.1 tCO₂

    Args:
        energy_kwh: Total electricity the pump WOULD have consumed from grid
        emission_factor: kg CO₂ per kWh (default = Pakistan grid)

    Returns:
        Baseline emissions in kg CO₂e
    """
    if energy_kwh <= 0:
        return 0.0
    return float(energy_kwh) * float(emission_factor)


# ─────────────────────────────────────────────────────────────────
# STEP 6: CALCULATE PROJECT EMISSIONS
# ─────────────────────────────────────────────────────────────────

def calculate_project_emissions(
    grid_energy_consumed_kwh: float,
    emission_factor: float = PAKISTAN_GRID_EF
) -> float:
    """
    Calculates actual emissions WITH the solar project installed.

    Project scenario: The pump runs on solar energy. Only the REMAINING
    grid electricity (when solar is insufficient) causes emissions.

    How solar reduces grid dependence:
      Without solar: pump uses 1,500 kWh/month from grid
      With solar:    solar generates 1,200 kWh → pump only needs 300 kWh from grid
      Grid avoided: 1,200 kWh (= 540 kg CO₂ saved this month)

    Excel equivalent:
      =F2 * $B$1   (grid_consumed × emission_factor)

    Formula:
      Project Emissions (kg CO₂) = Grid Energy Consumed (kWh) × Emission Factor

    Note: Solar-generated electricity has ZERO emissions (emission factor = 0),
          so only the grid portion counts.

    Args:
        grid_energy_consumed_kwh: kWh actually drawn from the grid WITH solar
        emission_factor: kg CO₂ per kWh

    Returns:
        Project emissions in kg CO₂e
    """
    if grid_energy_consumed_kwh is None or grid_energy_consumed_kwh <= 0:
        return 0.0
    return float(grid_energy_consumed_kwh) * float(emission_factor)


# ─────────────────────────────────────────────────────────────────
# STEP 7: CALCULATE EMISSION REDUCTION
# ─────────────────────────────────────────────────────────────────

def calculate_emission_reduction(
    baseline_kg: float,
    project_kg: float,
    to_tonnes: bool = False
) -> float:
    """
    Final calculation: how much CO₂ was AVOIDED by the solar project.

    This is the core MRV result — the environmental impact number.
    It answers: "How much climate benefit did this project create?"

    Excel equivalent:
      =MAX(0, G2 - H2)   (baseline - project, minimum 0)
      MAX(0,...) ensures we never report negative reductions

    Formula:
      Emission Reduction = Baseline Emissions − Project Emissions

    Example:
      Baseline = 8,100 kg CO₂  (what would have been emitted)
      Project  = 1,350 kg CO₂  (what was actually emitted)
      Reduction = 8,100 − 1,350 = 6,750 kg CO₂ = 6.75 tCO₂ AVOIDED

    Why this represents environmental impact:
      Each tonne of CO₂ avoided equals:
        → Planting ~50 trees for one year
        → Not driving ~4,000 km
        → Not burning ~380 liters of petrol

    Args:
        baseline_kg: Emissions without solar project (kg CO₂e)
        project_kg: Emissions with solar project (kg CO₂e)
        to_tonnes: If True, return result in metric tonnes instead of kg

    Returns:
        Emission reduction in kg CO₂e (or tCO₂e if to_tonnes=True)
    """
    reduction_kg = max(0.0, float(baseline_kg) - float(project_kg))
    if to_tonnes:
        return reduction_kg * KG_TO_TONNES
    return reduction_kg


# ─────────────────────────────────────────────────────────────────
# COMPLETE WATER SYSTEM CALCULATION
# ─────────────────────────────────────────────────────────────────

def calculate_water_system_emissions(
    monthly_water_records: list,
    pump_power_kw: float = None,
    grid_energy_records: list = None
) -> dict:
    """
    Full emission reduction calculation for ONE water system across all months.

    This function is called by the API route, receives database records,
    and returns a complete calculation breakdown.

    How operator data flows into this function:
      1. Operator enters "Pump Operating Hours" in the monthly data table
      2. Flask fetches those records from MonthlyWaterData table
      3. This function calculates energy, baseline, project, and reduction

    Args:
        monthly_water_records: List of MonthlyWaterData objects
        pump_power_kw: Power rating of the pump (from WaterSystem info)
        grid_energy_records: Optional list of MonthlyEnergyData (solar grid usage)

    Returns:
        dict with complete emission results per month and annual totals
    """
    monthly_results = []
    total_baseline_kg = 0.0
    total_project_kg = 0.0

    # Build lookup for solar grid consumption by month (if available)
    solar_by_month = {}
    if grid_energy_records:
        for rec in grid_energy_records:
            solar_by_month[rec.month] = getattr(rec, 'energy_consumed_from_grid', 0) or 0

    for record in monthly_water_records:
        month = record.month

        # Step 4: Calculate energy the pump would need from grid
        pump_hours = record.pump_operating_hours or 0
        baseline_energy_kwh = calculate_pump_energy_kwh(pump_hours, pump_power_kw)

        # Step 5: Baseline emissions (no solar → all energy from grid)
        baseline_kg = calculate_baseline_emissions(baseline_energy_kwh)

        # Step 6: Project emissions (solar covers some, grid covers rest)
        # If we have solar grid consumption data, use it directly
        # Otherwise assume solar covers the difference
        if month in solar_by_month:
            project_energy_kwh = solar_by_month[month]
        else:
            # Assume 30% of pump energy comes from grid (solar covers ~70%)
            # This is a conservative estimate when solar data is unavailable
            project_energy_kwh = baseline_energy_kwh * 0.30

        project_kg = calculate_project_emissions(project_energy_kwh)

        # Step 7: Emission reduction
        reduction_kg = calculate_emission_reduction(baseline_kg, project_kg)
        reduction_tonnes = reduction_kg * KG_TO_TONNES

        monthly_results.append({
            "month": month,
            "pump_hours": pump_hours,
            "baseline_energy_kwh": round(baseline_energy_kwh, 2),
            "grid_energy_kwh": round(project_energy_kwh, 2),
            "baseline_emission_kg": round(baseline_kg, 2),
            "project_emission_kg": round(project_kg, 2),
            "emission_reduction_kg": round(reduction_kg, 2),
            "emission_reduction_tco2": round(reduction_tonnes, 4),
        })

        total_baseline_kg += baseline_kg
        total_project_kg += project_kg

    total_reduction_kg = calculate_emission_reduction(total_baseline_kg, total_project_kg)

    return {
        "monthly": monthly_results,
        "annual": {
            "total_baseline_emission_kg": round(total_baseline_kg, 2),
            "total_project_emission_kg": round(total_project_kg, 2),
            "total_emission_reduction_kg": round(total_reduction_kg, 2),
            "total_emission_reduction_tco2": round(total_reduction_kg * KG_TO_TONNES, 4),
        }
    }


# ─────────────────────────────────────────────────────────────────
# COMPLETE SOLAR SYSTEM CALCULATION
# ─────────────────────────────────────────────────────────────────

def calculate_solar_system_emissions(monthly_energy_records: list) -> dict:
    """
    Full emission reduction calculation for ONE solar system.

    Solar emission reduction is direct:
      Reduction = Energy Exported to Grid × Grid Emission Factor
                + (Baseline Energy − Grid Consumed) × Emission Factor

    In simple terms:
      Every kWh generated by solar that REPLACES grid electricity
      avoids exactly (emission_factor) kg of CO₂.

    Excel analogy:
      Column A: Consumed from Grid  (kWh)
      Column B: Exported to Grid    (kWh)  ← fed back to national grid
      Column C: Baseline Energy     = A + B  (total solar generation estimate)
      Column D: Baseline Emissions  = C × 0.45
      Column E: Project Emissions   = A × 0.45   (only grid portion)
      Column F: Reduction           = D - E  = B × 0.45

    Args:
        monthly_energy_records: List of MonthlyEnergyData objects

    Returns:
        dict with complete solar emission results
    """
    monthly_results = []
    total_baseline_kg = 0.0
    total_project_kg = 0.0
    total_exported_kwh = 0.0

    for record in monthly_energy_records:
        consumed = record.energy_consumed_from_grid or 0
        exported = record.energy_exported_to_grid or 0

        # Estimated total solar generation = what went to grid + what pump consumed
        # Baseline = if NO solar, all that energy would have come from grid
        baseline_energy_kwh = consumed + exported
        baseline_kg = calculate_baseline_emissions(baseline_energy_kwh)

        # Project = only the grid portion (solar portion = 0 emissions)
        project_kg = calculate_project_emissions(consumed)

        reduction_kg = calculate_emission_reduction(baseline_kg, project_kg)

        monthly_results.append({
            "month": record.month,
            "consumed_from_grid_kwh": consumed,
            "exported_to_grid_kwh": exported,
            "solar_generated_kwh_est": round(baseline_energy_kwh, 2),
            "baseline_emission_kg": round(baseline_kg, 2),
            "project_emission_kg": round(project_kg, 2),
            "emission_reduction_kg": round(reduction_kg, 2),
            "emission_reduction_tco2": round(reduction_kg * KG_TO_TONNES, 4),
        })

        total_baseline_kg += baseline_kg
        total_project_kg += project_kg
        total_exported_kwh += exported

    total_reduction_kg = calculate_emission_reduction(total_baseline_kg, total_project_kg)

    # Equivalent trees planted (1 tCO₂ ≈ 50 trees for 1 year)
    trees_equivalent = int((total_reduction_kg * KG_TO_TONNES) * 50)

    return {
        "monthly": monthly_results,
        "annual": {
            "total_exported_kwh": round(total_exported_kwh, 2),
            "total_baseline_emission_kg": round(total_baseline_kg, 2),
            "total_project_emission_kg": round(total_project_kg, 2),
            "total_emission_reduction_kg": round(total_reduction_kg, 2),
            "total_emission_reduction_tco2": round(total_reduction_kg * KG_TO_TONNES, 4),
            "trees_equivalent": trees_equivalent,
        }
    }


# ─────────────────────────────────────────────────────────────────
# AUDIT TRAIL — Verification & Transparency
# ─────────────────────────────────────────────────────────────────

def build_audit_record(calculation_result: dict, system_id: str, system_type: str,
                        year: int, analyst_id: str = None) -> dict:
    """
    Creates an audit-ready calculation record.

    Why audit trails are important for MRV:
      - Climate credits require proof that reductions are REAL and VERIFIABLE
      - Regulators and auditors need to trace every number back to raw data
      - Timestamps prove when the calculation was done
      - Linking to system_id ties calculations to physical equipment

    This is like a "chain of custody" for carbon calculations.

    Args:
        calculation_result: Output from calculate_*_emissions()
        system_id: UUID of the water or solar system
        system_type: 'water' or 'solar'
        year: Year of calculation
        analyst_id: Who verified the calculation

    Returns:
        Audit record dict ready to store in emission_results table
    """
    annual = calculation_result.get("annual", {})
    return {
        "system_id": system_id,
        "system_type": system_type,
        "year": year,
        "baseline_emission": annual.get("total_baseline_emission_kg", 0),
        "project_emission": annual.get("total_project_emission_kg", 0),
        "emission_reduction": annual.get("total_emission_reduction_kg", 0),
        "emission_reduction_tco2": annual.get("total_emission_reduction_tco2", 0),
        "emission_factor_used": PAKISTAN_GRID_EF,
        "calculation_methodology": "IPCC AR6 / NEPRA Grid EF / GS MRV v2",
        "calculated_at": datetime.utcnow().isoformat(),
        "verified_by": analyst_id,
        "is_verified": analyst_id is not None,
    }
