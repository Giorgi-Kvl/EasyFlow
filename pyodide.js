// Ensure loadPyodide is available globally (e.g., via <script> tag)
// If using in Node.js, you'd import it differently.

let pyodide = null; // Module-level variable to store the loaded Pyodide instance
let pyodideLoadingPromise = null; // To handle concurrent load requests

/**
 * Loads Pyodide and installs pyflowchart if not already done.
 * Manages a single instance and loading promise.
 * @returns {Promise<PyodideInterface>} A promise that resolves with the Pyodide instance.
 */
async function loadAndSetupPyodide() {
    // If Pyodide is already loaded, return it immediately
    if (pyodide) {
        console.log("Pyodide already loaded.");
        return pyodide;
    }

    // If Pyodide is currently loading, return the existing promise
    if (pyodideLoadingPromise) {
        console.log("Pyodide is currently loading, waiting...");
        return pyodideLoadingPromise;
    }

    // Start loading Pyodide and store the promise
    console.log("Initiating Pyodide loading...");
    pyodideLoadingPromise = (async () => {
        try {
            console.log("Loading Pyodide runtime...");
            const loadedPyodide = await loadPyodide();
            console.log("Pyodide loaded. Loading micropip...");

            // Load micropip
            await loadedPyodide.loadPackage("micropip");
            const micropip = loadedPyodide.pyimport("micropip");
            console.log("Micropip loaded. Installing pyflowchart...");

            // Install pyflowchart
            await micropip.install('pyflowchart');
            console.log("pyflowchart installed successfully.");

            pyodide = loadedPyodide; // Store the loaded instance
            pyodideLoadingPromise = null; // Clear the loading promise
            return pyodide;

        } catch (error) {
            console.error("Error during Pyodide setup:", error);
            pyodideLoadingPromise = null; // Clear promise on error
            pyodide = null; // Ensure pyodide isn't partially set
            throw error; // Re-throw the error to indicate failure
        }
    })();

    return pyodideLoadingPromise;
}


/**
 * Generates a text-based flowchart for the given Python code string.
 * Handles Pyodide loading and package installation automatically.
 *
 * @param {string} codeToAnalyze The Python code snippet for which to generate a flowchart.
 * @returns {Promise<string>} A promise that resolves with the flowchart text.
 * @throws {Error} Throws an error if Pyodide loading, package installation,
 *                 or flowchart generation fails.
 */
async function getFlowchartText(codeToAnalyze) {
    console.log("Request received to generate flowchart.");

    try {
        // 1. Ensure Pyodide is loaded and pyflowchart is installed
        const pyodideInstance = await loadAndSetupPyodide();
        if (!pyodideInstance) {
            // This case should ideally be handled by loadAndSetupPyodide throwing
            throw new Error("Pyodide initialization failed silently.");
        }
        console.log("Pyodide ready. Preparing Python execution...");

        // 2. Construct the Python script to execute within Pyodide
        // We need to pass the user's code *as a string* to Flowchart.from_code
        const pythonWrapperCode = `
        # --- Python Wrapper for Pyodide ---
        from pyflowchart import Flowchart
        import sys
        import io

        # The code snippet provided by the caller
        # Use triple quotes within Python to handle multi-line strings correctly
        code_for_flowchart = """
        ${codeToAnalyze.replace(/"""/g, '\\"\\"\\"')}
        """ # Basic escaping for triple quotes just in case

        print("Python: Generating flowchart object...") # Log from Python side
        fc = Flowchart.from_code(code_for_flowchart)
        print("Python: Flowchart object created.")

        # Get the flowchart text. This MUST be the last expression evaluated
        # so its value is returned to JavaScript by runPython().
        print("Python: Retrieving flowchart text...")
        result = fc.flowchart()
        print("Python: Flowchart text retrieved.")
        result
        # --- End of Python Wrapper ---
        `;

        // 3. Execute the Python code
        console.log("Executing Python code in Pyodide...");
        let flowchartText = pyodideInstance.runPython(pythonWrapperCode);
        console.log("Python execution finished. Flowchart text received.");

        // 4. Return the result
        return flowchartText;

    } catch (error) {
        // Log the detailed error and re-throw it for the caller
        console.error("Error during flowchart generation process:", error);
        throw new Error(`Flowchart generation failed: ${error.message}`);
    }
}

// --- Example Usage ---
// You would call getFlowchartText like this:

const myPythonCode = `
x = 5
y = 10
while x != y:
    if x > y:
        x = x - y
    else:
        y = y - x

assert x == y
print(x)
`;

// Example of how to call the function and handle the result/error
async function runExample(PythonCode) {
    console.log("--- Starting Flowchart Generation Example ---");
    try {
        const flowchartCode = await getFlowchartText(PythonCode);
        console.log("\n--- Generated Flowchart Text ---");
        console.log(flowchartCode);
        console.log("--- Example Finished Successfully ---");
        return flowchartCode;
    } catch (error) {
        console.error("\n--- Example Failed ---");
        console.error(error);
    }
}

// Uncomment to run the example when this script loads:
// runExample();

// Optional: Trigger pre-loading without waiting for the first call
loadAndSetupPyodide().catch(err => console.error("Initial background Pyodide load failed:", err));