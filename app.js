const API_URL =
    "https://script.google.com/macros/s/AKfycbyC-Z_-e5pZqnxeLJtodrA-E6anWk4QA8axp7QHdN60GsBhDb9DqOu5-5zpylWyaJTLwQ/exec";

let currentUser = null;

let allTransactions = [];
let allStores = [];
let allProducts = [];
let allAds = [];
let allOrders = [];
let activeStoreId = null;


/* =========================================================
   USER
========================================================= */

function selectUser(user) {

    currentUser = user;

    document.getElementById("navUser").innerText = user;

    document
        .getElementById("userSelectPage")
        .classList.remove("active");

    document
        .getElementById("mainAppPage")
        .classList.add("active");

    loadData();
}


function switchUser() {

    currentUser = null;

    document
        .getElementById("mainAppPage")
        .classList.remove("active");

    document
        .getElementById("userSelectPage")
        .classList.add("active");
}


/* =========================================================
   TABS
========================================================= */

function switchTab(tabName) {

    document
        .querySelectorAll(".tab-btn")
        .forEach(btn => btn.classList.remove("active"));

    document
        .querySelectorAll(".section-content")
        .forEach(sec => sec.classList.remove("active"));


    const tabId =
        "tab" +
        tabName.charAt(0).toUpperCase() +
        tabName.slice(1);


    const sectionId =
        "section" +
        tabName.charAt(0).toUpperCase() +
        tabName.slice(1);


    document
        .getElementById(tabId)
        .classList.add("active");

    document
        .getElementById(sectionId)
        .classList.add("active");


    if (tabName === "checkout") {

        renderCheckoutStores();

        renderOrdersList();

        updateCheckoutSummary();
    }
}


/* =========================================================
   MONEY CATEGORY
========================================================= */

function handleCategoryChange() {

    const category =
        document.getElementById("category").value;

    const profileGroup =
        document.getElementById("profileGroup");

    const profileInput =
        document.getElementById("profile");

    const profileLabel =
        document.getElementById("profileLabel");


    if (category === "Private") {

        profileGroup.style.display = "block";

        profileLabel.innerText =
            "Private Profile:";

        profileInput.value =
            currentUser;

        profileInput.readOnly = true;

    }

    else if (category === "Debt") {

        profileGroup.style.display = "block";

        profileLabel.innerText =
            "Debt Person Name:";

        profileInput.value = "";

        profileInput.readOnly = false;

    }

    else {

        profileGroup.style.display = "none";

        profileInput.value = "";
    }
}


/* =========================================================
   LOAD DATA
========================================================= */

async function loadData() {

    try {

        const response =
            await fetch(API_URL);

        const data =
            await response.json();


        allTransactions =
            data.transactions || [];

        allStores =
            data.stores || [];

        allProducts =
            data.products || [];

        allAds =
            data.ads || [];

        allOrders =
            data.orders || [];

        let totalCash = 0;
        let totalDebt = 0;

        let privateI = 0;
        let privateN = 0;

        let debtProfiles = {};


        const historyList =
            document.getElementById("historyList");

        historyList.innerHTML = "";


        const now =
            new Date().getTime();


        allTransactions.forEach(row => {

            const amount =
                parseFloat(row.Amount) || 0;

            const action =
                row.Action;

            const category =
                row.Category;

            const profile =
                row.Profile
                    ? row.Profile.trim()
                    : "";


            if (category === "Work") {

                if (action === "Add")
                    totalCash += amount;

                if (action === "Remove")
                    totalCash -= amount;
            }


            else if (category === "Private") {

                if (action === "Add") {

                    totalCash += amount;

                    if (profile === "I")
                        privateI += amount;

                    if (profile === "N")
                        privateN += amount;
                }

                else if (action === "Remove") {

                    totalCash -= amount;

                    if (profile === "I")
                        privateI -= amount;

                    if (profile === "N")
                        privateN -= amount;
                }
            }


            else if (category === "Debt") {

                if (profile) {

                    if (!debtProfiles[profile])
                        debtProfiles[profile] = 0;


                    if (action === "Add") {

                        totalCash += amount;

                        totalDebt += amount;

                        debtProfiles[profile] += amount;
                    }


                    else if (action === "Remove") {

                        totalCash -= amount;

                        totalDebt -= amount;

                        debtProfiles[profile] -= amount;
                    }
                }
            }


            const txTime =
                new Date(row.Timestamp).getTime();


            const diffMinutes =
                (now - txTime) / (1000 * 60);


            let cancelBtnHtml = "";


            if (
                !isNaN(diffMinutes) &&
                diffMinutes >= 0 &&
                diffMinutes <= 30
            ) {

                cancelBtnHtml = `
                    <button
                        onclick="cancelTransaction(${row.rowIndex})"
                        class="cancel-btn">

                        Cancel / Delete

                    </button>
                `;
            }


            const li =
                document.createElement("li");


            li.className =
                String(action || "").toLowerCase();


            const profileText =
                profile
                    ? `(${profile})`
                    : "";


            li.innerHTML = `
                <strong>
                    ${escapeHtml(action)}
                    $${amount.toFixed(2)}
                </strong>

                <small>
                    Category:
                    ${escapeHtml(category)}
                    ${escapeHtml(profileText)}
                    |
                    By:
                    ${escapeHtml(row.User || "")}
                    |
                    ${new Date(row.Timestamp).toLocaleString()}
                </small>

                ${cancelBtnHtml}
            `;


            historyList.insertBefore(
                li,
                historyList.firstChild
            );

        });


        /*
         * Debt is intentionally subtracted from
         * cash to calculate net money.
         */

        const totalNetMoney =
            totalCash - totalDebt;


        document.getElementById("totalCash")
            .innerText =
            `$${totalCash.toFixed(2)}`;


        document.getElementById("totalDebt")
            .innerText =
            `$${totalDebt.toFixed(2)}`;


        document.getElementById("totalNetMoney")
            .innerText =
            `$${totalNetMoney.toFixed(2)}`;


        document.getElementById("privateI")
            .innerText =
            `$${privateI.toFixed(2)}`;


        document.getElementById("privateN")
            .innerText =
            `$${privateN.toFixed(2)}`;


        renderDebtProfiles(debtProfiles);

        renderStoresList();
        renderCheckoutStores();
        renderOrdersList();

        if (activeStoreId)
            renderStoreDetail(activeStoreId);

    }

    catch (error) {

        console.error(
            "Error loading data:",
            error
        );
    }
}


/* =========================================================
   DEBT PROFILES
========================================================= */

function renderDebtProfiles(debtProfiles) {

    const container =
        document.getElementById(
            "debtProfilesContainer"
        );


    container.innerHTML = "";


    const names =
        Object.keys(debtProfiles);


    if (names.length === 0) {

        container.innerHTML = `
            <small
                style="
                    color:var(--text-muted);
                    text-align:center;
                    width:100%;
                ">

                No debt profiles recorded yet.

            </small>
        `;

        return;
    }


    names.forEach(name => {

        const balance =
            debtProfiles[name];


        const card =
            document.createElement("div");


        card.className =
            "profile-card";


        card.onclick =
            () => openDebtProfile(name);


        card.innerHTML = `
            <h4>
                ${escapeHtml(name)}
            </h4>

            <p
                style="
                    color:
                    ${balance >= 0
                        ? "var(--success)"
                        : "var(--danger)"};
                ">

                $${balance.toFixed(2)}

            </p>

            <small>
                Click to manage
            </small>
        `;


        container.appendChild(card);

    });
}


/* =========================================================
   PROFILE
========================================================= */

function openProfile(profileName) {

    document
        .getElementById("modalActionContainer")
        .innerHTML = "";


    showModalHistory(
        `Private Transactions for User ${profileName}`,
        row =>
            row.Category === "Private" &&
            row.Profile === profileName
    );
}


/* =========================================================
   DEBT PROFILE
========================================================= */

function openDebtProfile(profileName) {

    const modalActionContainer =
        document.getElementById(
            "modalActionContainer"
        );


    modalActionContainer.innerHTML = `

        <div
            style="
                margin-bottom:15px;
                background:#f9fafb;
                padding:12px;
                border-radius:8px;
                border:1px solid #e5e7eb;
            ">

            <h4
                style="
                    margin:0 0 8px 0;
                    font-size:0.9rem;
                ">

                Manage Debt for
                ${escapeHtml(profileName)}

            </h4>


            <div
                style="
                    display:flex;
                    gap:8px;
                    margin-bottom:8px;
                ">

                <select
                    id="modalActionType"
                    style="
                        flex:1;
                        padding:8px;
                        border-radius:6px;
                        border:1px solid #d1d5db;
                    ">

                    <option value="Add">
                        Add Debt
                    </option>

                    <option value="Remove">
                        Remove / Settle
                    </option>

                </select>


                <input
                    type="number"
                    id="modalAmount"
                    placeholder="Amount ($)"
                    step="0.01"
                    style="
                        flex:1;
                        padding:8px;
                        border-radius:6px;
                        border:1px solid #d1d5db;
                    ">

            </div>


            <button
                onclick="submitModalDebt('${escapeJs(profileName)}')"
                style="
                    width:100%;
                    padding:8px;
                    background:var(--primary);
                    color:white;
                    border:none;
                    border-radius:6px;
                    font-weight:bold;
                    cursor:pointer;
                ">

                Submit Transaction

            </button>

        </div>
    `;


    showModalHistory(
        `Debt Transactions for ${profileName}`,
        row =>
            row.Category === "Debt" &&
            row.Profile &&
            row.Profile.trim() === profileName
    );
}


async function submitModalDebt(profileName) {

    const action =
        document.getElementById(
            "modalActionType"
        ).value;


    const amount =
        document.getElementById(
            "modalAmount"
        ).value;


    if (
        !amount ||
        isNaN(amount) ||
        parseFloat(amount) <= 0
    ) {

        alert(
            "Please enter a valid amount."
        );

        return;
    }


    try {

        await fetch(API_URL, {

            method: "POST",

            body: JSON.stringify({

                user: currentUser,

                action: action,

                amount: amount,

                category: "Debt",

                profile: profileName

            }),

            headers: {
                "Content-Type":
                    "text/plain;charset=utf-8"
            }

        });


        await loadData();

        openDebtProfile(profileName);

    }

    catch (error) {

        alert(
            "Failed to record transaction."
        );
    }
}


/* =========================================================
   MODAL HISTORY
========================================================= */

function showModalHistory(
    titleText,
    filterCondition
) {

    const modal =
        document.getElementById(
            "profileModal"
        );


    const modalTitle =
        document.getElementById(
            "modalTitle"
        );


    const modalHistoryList =
        document.getElementById(
            "modalHistoryList"
        );


    modalTitle.innerText =
        titleText;


    modalHistoryList.innerHTML = "";


    const filteredTransactions =
        allTransactions.filter(
            filterCondition
        );


    if (filteredTransactions.length === 0) {

        modalHistoryList.innerHTML =
            "<li>No transactions found for this profile.</li>";

    }

    else {

        filteredTransactions.forEach(row => {

            const li =
                document.createElement("li");


            li.className =
                String(row.Action || "")
                    .toLowerCase();


            li.innerHTML = `
                <strong>
                    ${escapeHtml(row.Action)}
                    $${(
                        parseFloat(row.Amount) || 0
                    ).toFixed(2)}
                </strong>

                <small>
                    Done by:
                    ${escapeHtml(row.User || "")}
                    |
                    ${new Date(
                        row.Timestamp
                    ).toLocaleString()}
                </small>
            `;


            modalHistoryList.appendChild(li);

        });
    }


    modal.style.display = "flex";
}


function closeModal() {

    document.getElementById(
        "profileModal"
    ).style.display = "none";
}


/* =========================================================
   DELETE TRANSACTION
========================================================= */

async function cancelTransaction(rowIndex) {

    if (
        !confirm(
            "Are you sure you want to cancel and delete this transaction?"
        )
    ) {
        return;
    }


    try {

        await fetch(API_URL, {

            method: "POST",

            body: JSON.stringify({
                actionType:
                    "delete_transaction",
                rowIndex: rowIndex
            }),

            headers: {
                "Content-Type":
                    "text/plain;charset=utf-8"
            }

        });


        await loadData();

    }

    catch (error) {

        alert(
            "Failed to delete transaction."
        );
    }
}


/* =========================================================
   MONEY FORM
========================================================= */

document
    .getElementById("transactionForm")
    .addEventListener(
        "submit",
        async function(e) {

            e.preventDefault();


            const btn =
                document.getElementById(
                    "submitBtn"
                );


            const status =
                document.getElementById(
                    "statusMessage"
                );


            btn.disabled = true;

            btn.innerText =
                "Saving...";


            const category =
                document.getElementById(
                    "category"
                ).value;


            let profileVal =
                document.getElementById(
                    "profile"
                ).value;


            if (category === "Private") {

                profileVal =
                    currentUser;
            }


            const payload = {

                user: currentUser,

                action:
                    document.getElementById(
                        "action"
                    ).value,

                amount:
                    document.getElementById(
                        "amount"
                    ).value,

                category:
                    category,

                profile:
                    profileVal

            };


            try {

                await fetch(API_URL, {

                    method: "POST",

                    body: JSON.stringify(
                        payload
                    ),

                    headers: {
                        "Content-Type":
                            "text/plain;charset=utf-8"
                    }

                });


                status.innerText =
                    "Saved successfully!";

                status.style.color =
                    "green";


                document
                    .getElementById(
                        "transactionForm"
                    )
                    .reset();


                handleCategoryChange();

                await loadData();

            }

            catch (error) {

                status.innerText =
                    "Error saving transaction.";

                status.style.color =
                    "red";
            }


            finally {

                btn.disabled = false;

                btn.innerText =
                    "Save Transaction";


                setTimeout(
                    () =>
                        status.innerText = "",
                    3000
                );
            }

        }
    );


/* =========================================================
   STORES
========================================================= */

async function createStore() {

    const nameInput =
        document.getElementById(
            "newStoreName"
        );


    const storeName =
        nameInput.value.trim();


    if (!storeName)
        return;


    await fetch(API_URL, {

        method: "POST",

        body: JSON.stringify({

            actionType:
                "add_store",

            storeName:
                storeName

        }),

        headers: {
            "Content-Type":
                "text/plain;charset=utf-8"
        }

    });


    nameInput.value = "";

    await loadData();
}


function renderStoresList() {

    const container =
        document.getElementById(
            "storesContainer"
        );


    container.innerHTML = "";


    if (allStores.length === 0) {

        container.innerHTML = `
            <small
                style="
                    color:var(--text-muted);
                ">

                No stores created yet.

            </small>
        `;

        return;
    }


    allStores.forEach(store => {

        const div =
            document.createElement("div");


        div.style.cssText = `
            padding:12px;
            background:#f9fafb;
            border:1px solid #e5e7eb;
            border-radius:8px;
            display:flex;
            justify-content:space-between;
            align-items:center;
            cursor:pointer;
        `;


        div.onclick =
            () =>
                openStoreDetail(
                    store.StoreId,
                    store.StoreName
                );


        div.innerHTML = `
            <strong>
                ${escapeHtml(store.StoreName)}
            </strong>

            <small
                style="color:var(--primary);">

                Manage &rarr;

            </small>
        `;


        container.appendChild(div);

    });
}


function openStoreDetail(
    storeId,
    storeName
) {

    activeStoreId =
        storeId;


    document.getElementById(
        "detailStoreName"
    ).innerText =
        storeName;


    document.getElementById(
        "storesContainer"
    ).parentElement
     .style.display =
        "none";


    document.getElementById(
        "storeDetailView"
    ).style.display =
        "block";


    renderStoreDetail(storeId);
}


function backToStores() {

    activeStoreId = null;


    document.getElementById(
        "storeDetailView"
    ).style.display =
        "none";


    document.getElementById(
        "storesContainer"
    ).parentElement
     .style.display =
        "block";
}


/* =========================================================
   STORE DETAIL
========================================================= */

function renderStoreDetail(storeId) {

    const storeProducts =
        allProducts.filter(
            p => p.StoreId == storeId
        );


    const storeAdsList =
        allAds.filter(
            a => a.StoreId == storeId
        );


    let capital = 0;

    let totalAdSpend = 0;

    let totalCorruptedLoss = 0;


    storeProducts.forEach(p => {

        let qtyVal =
            parseFloat(p.Qty);


        if (isNaN(qtyVal)) {

            try {

                const attr =
                    JSON.parse(
                        p.Attributes || "{}"
                    );


                qtyVal =
                    Object.values(attr)
                        .reduce(
                            (a, b) =>
                                a +
                                (parseFloat(b) || 0),
                            0
                        );

            }

            catch(e) {

                qtyVal = 0;
            }
        }


        capital +=
            (parseFloat(p.Cost) || 0) *
            qtyVal;


        allTransactions.forEach(tx => {

            if (
                tx.Notes &&
                tx.Notes.includes(
                    "Corrupted Stock Loss"
                ) &&
                tx.Notes.includes(p.Name)
            ) {

                totalCorruptedLoss +=
                    parseFloat(
                        tx.Amount
                    ) || 0;
            }

        });

    });


    storeAdsList.forEach(a => {

        totalAdSpend +=
            parseFloat(a.Amount) || 0;

    });


    /*
     * Profit from orders that actually got delivered
     * for this store. Cash was only added to the Money
     * tab when an order became Delivered, so this is
     * the real, realized profit contribution from sales.
     */

    let deliveredOrdersProfit = 0;

    (allOrders || [])
        .filter(o =>
            String(o.StoreId) === String(storeId) &&
            o.Status === "Delivered"
        )
        .forEach(o => {

            deliveredOrdersProfit +=
                parseFloat(o.Profit) || 0;

        });


    const storeProfit =
        deliveredOrdersProfit -
        totalAdSpend -
        totalCorruptedLoss;


    document.getElementById(
        "storeCapital"
    ).innerText =
        `$${capital.toFixed(2)}`;


    document.getElementById(
        "storeAds"
    ).innerText =
        `$${totalAdSpend.toFixed(2)}`;


    document.getElementById(
        "storeProfit"
    ).innerText =
        `$${storeProfit.toFixed(2)}`;


    document.getElementById(
        "storeNet"
    ).innerText =
        `$${(
            capital +
            storeProfit
        ).toFixed(2)}`;


    const prodListContainer =
        document.getElementById(
            "storeProductsList"
        );


    prodListContainer.innerHTML = "";


    if (storeProducts.length === 0) {

        prodListContainer.innerHTML = `
            <small
                style="color:var(--text-muted);">

                No products in this store.

            </small>
        `;

        return;
    }


    storeProducts.forEach(prod => {

        let attributesObj = {};


        try {

            attributesObj =
                JSON.parse(
                    prod.Attributes || "{}"
                );

        }

        catch(e) {}


        let attrHtml = "";


        for (let key in attributesObj) {

            attrHtml += `

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        background:#eef2ff;
                        padding:6px 10px;
                        border-radius:6px;
                        margin-bottom:4px;
                        font-size:0.85rem;
                    ">

                    <span>

                        <strong>
                            ${escapeHtml(key)}
                        </strong>:

                        ${attributesObj[key]}

                    </span>


                    <div
                        style="
                            display:flex;
                            gap:4px;
                        ">

                        <button
                            onclick="
                                adjustVariantInline(
                                    '${escapeJs(prod.ProductId)}',
                                    '${escapeJs(key)}',
                                    1,
                                    'add'
                                )
                            "
                            style="
                                background:var(--success);
                                color:white;
                                border:none;
                                padding:2px 6px;
                                border-radius:4px;
                                cursor:pointer;
                            "
                            title="Add Stock">

                            +

                        </button>


                        <button
                            onclick="
                                adjustVariantInline(
                                    '${escapeJs(prod.ProductId)}',
                                    '${escapeJs(key)}',
                                    1,
                                    'reduce'
                                )
                            "
                            style="
                                background:#f59e0b;
                                color:white;
                                border:none;
                                padding:2px 6px;
                                border-radius:4px;
                                cursor:pointer;
                            "
                            title="Reduce Stock">

                            -

                        </button>


                        <button
                            onclick="
                                adjustVariantInline(
                                    '${escapeJs(prod.ProductId)}',
                                    '${escapeJs(key)}',
                                    1,
                                    'loss'
                                )
                            "
                            style="
                                background:var(--danger);
                                color:white;
                                border:none;
                                padding:2px 6px;
                                border-radius:4px;
                                cursor:pointer;
                            "
                            title="Corrupted Stock">

                            🗑️

                        </button>

                    </div>

                </div>

            `;
        }


        if (!attrHtml) {

            attrHtml = `
                <small
                    style="
                        color:var(--text-muted);
                    ">

                    No variations added yet.

                </small>
            `;
        }


        let displayQty =
            parseFloat(prod.Qty);


        if (isNaN(displayQty)) {

            displayQty =
                Object.values(attributesObj)
                    .reduce(
                        (a, b) =>
                            a +
                            (parseFloat(b) || 0),
                        0
                    );
        }


        const card =
            document.createElement("div");


        card.style.cssText = `
            padding:14px;
            background:#f9fafb;
            border:1px solid #e5e7eb;
            border-radius:8px;
            display:flex;
            flex-direction:column;
            gap:10px;
        `;


        card.innerHTML = `

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:flex-start;
                ">

                <div>

                    <strong
                        style="
                            font-size:1.05rem;
                        ">

                        ${escapeHtml(prod.Name)}

                    </strong>

                    <br>

                    <small
                        style="color:#4b5563;">

                        Unit Cost:
                        $${parseFloat(prod.Cost || 0).toFixed(2)}

                        |

                        Total Stock Qty:

                        <strong>
                            ${displayQty}
                        </strong>

                    </small>

                </div>


                <div
                    style="
                        display:flex;
                        gap:6px;
                    ">

                    <button
                        onclick="
                            editProduct(
                                '${escapeJs(prod.ProductId)}'
                            )
                        "
                        style="
                            background:var(--primary);
                            color:white;
                            border:none;
                            padding:6px 10px;
                            border-radius:4px;
                            font-size:0.75rem;
                            cursor:pointer;
                        ">

                        Edit Info

                    </button>

                </div>

            </div>


            <div>

                <small
                    style="
                        font-weight:600;
                        color:#374151;
                    ">

                    Variations / Colors & Stock Controls:

                </small>


                <div
                    style="margin-top:6px;">

                    ${attrHtml}

                </div>

            </div>


            <div
                style="
                    display:flex;
                    gap:8px;
                    margin-top:4px;
                    background:white;
                    padding:8px;
                    border:1px dashed #d1d5db;
                    border-radius:6px;
                ">

                <input
                    type="text"
                    id="newVarName_${escapeHtml(prod.ProductId)}"
                    placeholder="New variant (e.g. Blue)"
                    style="
                        flex:2;
                        padding:6px;
                        border:1px solid #d1d5db;
                        border-radius:4px;
                        font-size:0.8rem;
                    ">


                <input
                    type="number"
                    id="newVarQty_${escapeHtml(prod.ProductId)}"
                    placeholder="Qty"
                    value="1"
                    min="1"
                    style="
                        flex:1;
                        padding:6px;
                        border:1px solid #d1d5db;
                        border-radius:4px;
                        font-size:0.8rem;
                    ">


                <button
                    onclick="
                        addNewVariantInline(
                            '${escapeJs(prod.ProductId)}'
                        )
                    "
                    style="
                        background:var(--success);
                        color:white;
                        border:none;
                        padding:6px 12px;
                        border-radius:4px;
                        font-size:0.8rem;
                        font-weight:bold;
                        cursor:pointer;
                    ">

                    Add

                </button>

            </div>

        `;


        prodListContainer.appendChild(card);

    });
}


/* =========================================================
   PRODUCT
========================================================= */

function openAddProductModal() {

    document.getElementById(
        "editProductId"
    ).value = "";


    document.getElementById(
        "productModalTitle"
    ).innerText =
        "Add Product";


    document.getElementById(
        "productForm"
    ).reset();


    document.getElementById(
        "productModal"
    ).style.display =
        "flex";
}


function editProduct(productId) {

    const prod =
        allProducts.find(
            p => p.ProductId == productId
        );


    if (!prod)
        return;


    document.getElementById(
        "editProductId"
    ).value =
        prod.ProductId;


    document.getElementById(
        "productModalTitle"
    ).innerText =
        "Edit Product";


    document.getElementById(
        "prodName"
    ).value =
        prod.Name;


    document.getElementById(
        "prodCost"
    ).value =
        prod.Cost;


    document.getElementById(
        "productModal"
    ).style.display =
        "flex";
}


function closeProductModal() {

    document.getElementById(
        "productModal"
    ).style.display =
        "none";
}


async function submitProduct(e) {

    e.preventDefault();


    const editId =
        document.getElementById(
            "editProductId"
        ).value;


    const actionType =
        editId
            ? "edit_product"
            : "add_product";


    const payload = {

        actionType,

        productId:
            editId,

        user:
            currentUser,

        storeId:
            activeStoreId,

        name:
            document.getElementById(
                "prodName"
            ).value,

        cost:
            document.getElementById(
                "prodCost"
            ).value

    };


    await fetch(API_URL, {

        method: "POST",

        body:
            JSON.stringify(payload),

        headers: {
            "Content-Type":
                "text/plain;charset=utf-8"
        }

    });


    closeProductModal();

    document
        .getElementById(
            "productForm"
        )
        .reset();

    await loadData();
}


/* =========================================================
   VARIATIONS
========================================================= */

async function addNewVariantInline(productId) {

    const nameInput =
        document.getElementById(
            `newVarName_${productId}`
        );


    const qtyInput =
        document.getElementById(
            `newVarQty_${productId}`
        );


    const variantName =
        nameInput.value.trim();


    const variantQty =
        parseFloat(qtyInput.value);


    if (
        !variantName ||
        isNaN(variantQty) ||
        variantQty <= 0
    ) {

        alert(
            "Please enter a valid variation name and quantity."
        );

        return;
    }


    await fetch(API_URL, {

        method: "POST",

        body: JSON.stringify({

            actionType:
                "update_product_attributes",

            user:
                currentUser,

            productId:
                productId,

            variantName:
                variantName,

            variantQty:
                variantQty

        }),

        headers: {
            "Content-Type":
                "text/plain;charset=utf-8"
        }

    });


    await loadData();
}


async function adjustVariantInline(
    productId,
    variantName,
    defaultStep,
    mode
) {

    let msg =
        `Modify quantity for ${variantName}:`;


    if (mode === "reduce") {

        msg =
            `Reduce stock for ${variantName} (without counting as financial loss):`;
    }


    if (mode === "loss") {

        msg =
            `Mark corrupted stock/loss for ${variantName}:`;
    }


    const qtyStr =
        prompt(
            msg,
            Math.abs(defaultStep)
        );


    if (!qtyStr)
        return;


    const val =
        parseFloat(qtyStr);


    if (
        isNaN(val) ||
        val <= 0
    )
        return;


    let payload = {

        user:
            currentUser,

        productId:
            productId,

        variantName:
            variantName

    };


    if (mode === "add") {

        payload.actionType =
            "adjust_stock_non_loss";

        payload.changeQty =
            val;
    }


    else if (mode === "reduce") {

        payload.actionType =
            "adjust_stock_non_loss";

        payload.changeQty =
            -val;
    }


    else if (mode === "loss") {

        payload.actionType =
            "corrupted_product";

        payload.corruptedQty =
            val;
    }


    await fetch(API_URL, {

        method: "POST",

        body:
            JSON.stringify(payload),

        headers: {
            "Content-Type":
                "text/plain;charset=utf-8"
        }

    });


    await loadData();
}


/* =========================================================
   ADS
========================================================= */

function openAddAdModal() {

    document.getElementById(
        "adModal"
    ).style.display =
        "flex";
}


function closeAdModal() {

    document.getElementById(
        "adModal"
    ).style.display =
        "none";
}


async function submitAd(e) {

    e.preventDefault();


    const payload = {

        actionType:
            "add_ad",

        user:
            currentUser,

        storeId:
            activeStoreId,

        amount:
            document.getElementById(
                "adAmount"
            ).value,

        notes:
            document.getElementById(
                "adNotes"
            ).value

    };


    await fetch(API_URL, {

        method: "POST",

        body:
            JSON.stringify(payload),

        headers: {
            "Content-Type":
                "text/plain;charset=utf-8"
        }

    });


    closeAdModal();


    document
        .getElementById(
            "adForm"
        )
        .reset();


    await loadData();
}


/* =========================================================
   HTML SAFETY HELPERS
========================================================= */

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeJs(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");
}


/* =========================================================
   CHECKOUT
========================================================= */

let checkoutItems = [];

let qrScanner = null;


/* =========================================================
   CHECKOUT STORE
========================================================= */

function renderCheckoutStores() {

    const select =
        document.getElementById(
            "checkoutStore"
        );

    if (!select)
        return;


    const currentValue =
        select.value;


    select.innerHTML = `
        <option value="">
            Select a store
        </option>
    `;


    allStores.forEach(store => {

        const option =
            document.createElement("option");

        option.value =
            store.StoreId;

        option.textContent =
            store.StoreName;

        select.appendChild(option);

    });


    if (
        currentValue &&
        allStores.some(
            s =>
                String(s.StoreId) ===
                String(currentValue)
        )
    ) {

        select.value =
            currentValue;

    }

}


function checkoutStoreChanged() {

    checkoutItems = [];

    renderCheckoutItems();


    const storeId =
        document.getElementById(
            "checkoutStore"
        ).value;


    const productSelect =
        document.getElementById(
            "checkoutProduct"
        );


    productSelect.innerHTML = `
        <option value="">
            Select product
        </option>
    `;


    document.getElementById(
        "checkoutVariant"
    ).innerHTML = `
        <option value="">
            No variation
        </option>
    `;


    if (!storeId)
        return;


    allProducts
        .filter(
            p =>
                String(p.StoreId) ===
                String(storeId)
        )
        .forEach(product => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                product.ProductId;

            option.textContent =
                `${product.Name} — Stock: ${getProductTotalQty(product)}`;

            productSelect.appendChild(
                option
            );

        });

}


function checkoutProductChanged() {

    const productId =
        document.getElementById(
            "checkoutProduct"
        ).value;


    const variantSelect =
        document.getElementById(
            "checkoutVariant"
        );


    variantSelect.innerHTML = `
        <option value="">
            No variation
        </option>
    `;


    if (!productId)
        return;


    const product =
        allProducts.find(
            p =>
                String(p.ProductId) ===
                String(productId)
        );


    if (!product)
        return;


    let attributes = {};

    try {

        attributes =
            JSON.parse(
                product.Attributes ||
                "{}"
            );

    }

    catch (e) {

        attributes = {};

    }


    Object.keys(attributes)
        .forEach(variant => {

            const qty =
                parseFloat(
                    attributes[variant]
                ) || 0;


            if (qty <= 0)
                return;


            const option =
                document.createElement(
                    "option"
                );

            option.value =
                variant;

            option.textContent =
                `${variant} — Stock: ${qty}`;

            variantSelect.appendChild(
                option
            );

        });

}


/* =========================================================
   PRODUCT STOCK
========================================================= */

function getProductTotalQty(product) {

    let qty =
        parseFloat(
            product.Qty
        );


    if (!isNaN(qty))
        return qty;


    try {

        const attributes =
            JSON.parse(
                product.Attributes ||
                "{}"
            );


        return Object.values(
            attributes
        )
        .reduce(
            (total, value) =>
                total +
                (parseFloat(value) || 0),
            0
        );

    }

    catch (e) {

        return 0;

    }

}


/* =========================================================
   ADD PRODUCT TO ORDER
========================================================= */

function addCheckoutProduct() {

    const productId =
        document.getElementById(
            "checkoutProduct"
        ).value;


    const variant =
        document.getElementById(
            "checkoutVariant"
        ).value;


    const quantity =
        parseFloat(
            document.getElementById(
                "checkoutQuantity"
            ).value
        );


    if (!productId) {

        alert(
            "Please select a product."
        );

        return;

    }


    if (
        isNaN(quantity) ||
        quantity <= 0
    ) {

        alert(
            "Please enter a valid quantity."
        );

        return;

    }


    const product =
        allProducts.find(
            p =>
                String(p.ProductId) ===
                String(productId)
        );


    if (!product)
        return;


    let availableQty = 0;


    if (variant) {

        try {

            const attributes =
                JSON.parse(
                    product.Attributes ||
                    "{}"
                );


            availableQty =
                parseFloat(
                    attributes[variant]
                ) || 0;

        }

        catch (e) {

            availableQty = 0;

        }

    }

    else {

        availableQty =
            getProductTotalQty(
                product
            );

    }


    /*
     * Check quantity already selected
     * for the same product/variation.
     */

    const existing =
        checkoutItems.find(
            item =>
                String(
                    item.productId
                ) ===
                String(productId) &&
                String(
                    item.variant
                ) ===
                String(variant)
        );


    const alreadySelected =
        existing
            ? existing.quantity
            : 0;


    if (
        alreadySelected +
        quantity >
        availableQty
    ) {

        alert(
            `Only ${availableQty} available for this product/variation.`
        );

        return;

    }


    if (existing) {

        existing.quantity +=
            quantity;

    }

    else {

        checkoutItems.push({

            productId:
                product.ProductId,

            productName:
                product.Name,

            variant:
                variant,

            quantity:
                quantity,

            cost:
                parseFloat(
                    product.Cost
                ) || 0

        });

    }


    renderCheckoutItems();

}


/* =========================================================
   REMOVE CHECKOUT PRODUCT
========================================================= */

function removeCheckoutProduct(index) {

    checkoutItems.splice(
        index,
        1
    );

    renderCheckoutItems();

}


/* =========================================================
   RENDER CHECKOUT ITEMS
========================================================= */

function renderCheckoutItems() {

    const container =
        document.getElementById(
            "checkoutItems"
        );


    if (!container)
        return;


    container.innerHTML = "";


    if (
        checkoutItems.length === 0
    ) {

        container.innerHTML = `
            <small style="color:var(--text-muted);">
                No products added yet.
            </small>
        `;

        updateCheckoutSummary();

        return;

    }


    checkoutItems.forEach(
        (item, index) => {

            const div =
                document.createElement(
                    "div"
                );


            div.style.cssText = `
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:10px;
                padding:10px;
                background:#f9fafb;
                border:1px solid #e5e7eb;
                border-radius:8px;
            `;


            const variantText =
                item.variant
                    ? ` — ${escapeHtml(item.variant)}`
                    : "";


            div.innerHTML = `

                <div style="flex:1;">

                    <strong>
                        ${escapeHtml(
                            item.productName
                        )}
                    </strong>

                    ${variantText}

                    <br>

                    <small>
                        Qty:
                        ${item.quantity}

                        |

                        Cost:
                        $${(
                            item.cost *
                            item.quantity
                        ).toFixed(2)}
                    </small>

                </div>


                <button
                    type="button"
                    onclick="
                        removeCheckoutProduct(
                            ${index}
                        )
                    "
                    style="
                        background:var(--danger);
                        color:white;
                        border:none;
                        border-radius:6px;
                        padding:6px 10px;
                        cursor:pointer;
                    ">

                    Remove

                </button>

            `;


            container.appendChild(
                div
            );

        }
    );


    updateCheckoutSummary();

}


/* =========================================================
   CHECKOUT SUMMARY
========================================================= */

function updateCheckoutSummary() {

    const totalCost =
        checkoutItems.reduce(
            (total, item) =>
                total +
                (
                    item.cost *
                    item.quantity
                ),
            0
        );


    const sellingPrice =
        parseFloat(
            document.getElementById(
                "checkoutSellingPrice"
            )?.value
        ) || 0;


    const deliveryFee =
        parseFloat(
            document.getElementById(
                "checkoutDeliveryFee"
            )?.value
        ) || 0;


    const customerTotal =
        sellingPrice +
        deliveryFee;


    /*
     * Delivery is paid to courier.
     * Therefore it is NOT profit.
     */

    const profit =
        sellingPrice -
        totalCost;


    document.getElementById(
        "checkoutCost"
    ).innerText =
        `$${totalCost.toFixed(2)}`;


    document.getElementById(
        "checkoutSell"
    ).innerText =
        `$${sellingPrice.toFixed(2)}`;


    document.getElementById(
        "checkoutDelivery"
    ).innerText =
        `$${deliveryFee.toFixed(2)}`;


    document.getElementById(
        "checkoutCustomerTotal"
    ).innerText =
        `$${customerTotal.toFixed(2)}`;


    const profitElement =
        document.getElementById(
            "checkoutProfit"
        );


    profitElement.innerText =
        `$${profit.toFixed(2)}`;


    profitElement.style.color =
        profit >= 0
            ? "var(--success)"
            : "var(--danger)";

}


/* =========================================================
   CREATE ORDER
========================================================= */

async function createCheckoutOrder() {

    if (
        checkoutItems.length === 0
    ) {

        alert(
            "Add at least one product."
        );

        return;

    }


    const storeId =
        document.getElementById(
            "checkoutStore"
        ).value;


    const sellingPrice =
        parseFloat(
            document.getElementById(
                "checkoutSellingPrice"
            ).value
        );


    const deliveryFee =
        parseFloat(
            document.getElementById(
                "checkoutDeliveryFee"
            ).value
        ) || 0;


    const trackingNumber =
        document.getElementById(
            "checkoutTracking"
        ).value.trim();


    if (!storeId) {

        alert(
            "Please select a store."
        );

        return;

    }


    if (
        isNaN(sellingPrice) ||
        sellingPrice < 0
    ) {

        alert(
            "Enter a valid selling price."
        );

        return;

    }


    if (!trackingNumber) {

        alert(
            "Please scan the tracking QR code."
        );

        return;

    }


    const btn =
        document.getElementById(
            "createOrderBtn"
        );


    btn.disabled = true;

    btn.innerText =
        "Creating Order...";


    const status =
        document.getElementById(
            "checkoutStatus"
        );


    try {

        const response =
            await fetch(
                API_URL,
                {

                    method: "POST",

                    body:
                        JSON.stringify({

                            actionType:
                                "create_order",

                            user:
                                currentUser,

                            storeId:
                                storeId,

                            items:
                                checkoutItems,

                            sellingPrice:
                                sellingPrice,

                            deliveryFee:
                                deliveryFee,

                            trackingNumber:
                                trackingNumber

                        }),

                    headers: {

                        "Content-Type":
                            "text/plain;charset=utf-8"

                    }

                }
            );


        const result =
            await response.json();


        if (
            result.status !==
            "success"
        ) {

            throw new Error(
                result.message ||
                "Failed to create order."
            );

        }


        status.innerText =
            "Order created successfully!";

        status.style.color =
            "var(--success)";


        checkoutItems = [];


        document.getElementById(
            "checkoutSellingPrice"
        ).value = "";


        document.getElementById(
            "checkoutDeliveryFee"
        ).value = "0";


        document.getElementById(
            "checkoutTracking"
        ).value = "";


        renderCheckoutItems();


        await loadData();


        checkoutStoreChanged();

    }

    catch (error) {

        console.error(error);

        status.innerText =
            error.message ||
            "Failed to create order.";

        status.style.color =
            "var(--danger)";

    }

    finally {

        btn.disabled = false;

        btn.innerText =
            "Create Order";

    }

}


/* =========================================================
   ORDERS LIST
========================================================= */

function renderOrdersList() {

    const container =
        document.getElementById(
            "ordersList"
        );


    if (!container)
        return;


    container.innerHTML = "";


    if (
        !allOrders ||
        allOrders.length === 0
    ) {

        container.innerHTML = `
            <small style="color:var(--text-muted);">
                No orders yet.
            </small>
        `;

        return;

    }


    [...allOrders]
        .reverse()
        .forEach(order => {

            const card =
                document.createElement(
                    "div"
                );


            card.style.cssText = `
                border:1px solid #e5e7eb;
                border-radius:10px;
                padding:12px;
                background:#fff;
            `;


            const profit =
                parseFloat(
                    order.Profit
                ) || 0;


            const status =
                order.Status ||
                "Waiting";


            let statusColor =
                "#6b7280";


            if (
                status === "Delivered"
            )
                statusColor =
                    "var(--success)";


            if (
                status === "Waiting for return"
            )
                statusColor =
                    "#f59e0b";


            if (
                status === "Returned" ||
                status === "Cancelled"
            )
                statusColor =
                    "var(--danger)";


            card.innerHTML = `

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        gap:10px;
                    ">

                    <strong>
                        ${escapeHtml(
                            order.OrderId
                        )}
                    </strong>

                    <strong
                        style="
                            color:${statusColor};
                        ">

                        ${escapeHtml(status)}

                    </strong>

                </div>


                <small>
                    Store:
                    ${escapeHtml(
                        order.StoreName || ""
                    )}
                </small>


                <p style="margin:8px 0;">

                    ${escapeHtml(
                        order.Products || ""
                    )}

                </p>


                <small>

                    Tracking:
                    <strong>
                        ${escapeHtml(
                            order.TrackingNumber || ""
                        )}
                    </strong>

                </small>


                <div
                    style="
                        margin-top:10px;
                        display:grid;
                        grid-template-columns:
                            repeat(
                                auto-fit,
                                minmax(120px,1fr)
                            );
                        gap:6px;
                    ">

                    <div>
                        <small>
                            Cost
                        </small>

                        <strong>
                            $${(
                                parseFloat(
                                    order.TotalCost
                                ) || 0
                            ).toFixed(2)}
                        </strong>
                    </div>


                    <div>
                        <small>
                            Selling
                        </small>

                        <strong>
                            $${(
                                parseFloat(
                                    order.SellingPrice
                                ) || 0
                            ).toFixed(2)}
                        </strong>
                    </div>


                    <div>
                        <small>
                            Delivery
                        </small>

                        <strong>
                            $${(
                                parseFloat(
                                    order.DeliveryFee
                                ) || 0
                            ).toFixed(2)}
                        </strong>
                    </div>


                    <div>
                        <small>
                            Profit
                        </small>

                        <strong
                            style="
                                color:
                                ${profit >= 0
                                    ? "var(--success)"
                                    : "var(--danger)"};
                            ">

                            $${profit.toFixed(2)}

                        </strong>
                    </div>

                </div>


                ${
                    status ===
                    "Waiting for return"
                        ? `

                        <button
                            onclick="
                                markOrderReturned(
                                    '${escapeJs(
                                        order.OrderId
                                    )}'
                                )
                            "
                            style="
                                width:100%;
                                margin-top:10px;
                                padding:8px;
                                border:none;
                                border-radius:6px;
                                background:var(--primary);
                                color:white;
                                cursor:pointer;
                                font-weight:bold;
                            ">

                            Mark as Returned

                        </button>

                        `
                        : ""
                }

            `;


            container.appendChild(
                card
            );

        });

}


/* =========================================================
   MARK RETURNED (manual button on an order card)
========================================================= */

async function markOrderReturned(
    orderId
) {

    if (
        !confirm(
            "Confirm that this order has actually returned?"
        )
    )
        return;


    try {

        const response =
            await fetch(
                API_URL,
                {

                    method: "POST",

                    body:
                        JSON.stringify({

                            actionType:
                                "update_order_status",

                            orderId:
                                orderId,

                            status:
                                "Returned"

                        }),

                    headers: {

                        "Content-Type":
                            "text/plain;charset=utf-8"

                    }

                }
            );


        const result =
            await response.json();


        if (
            result.status !==
            "success"
        ) {

            throw new Error(
                result.message ||
                "Failed to update order."
            );

        }


        await loadData();

    }

    catch (error) {

        alert(
            error.message ||
            "Failed to update order."
        );

    }

}


/* =========================================================
   QR SCANNER (single tracking-number capture, used at
   checkout time to fill in the tracking field)
========================================================= */

async function openQrScanner() {

    const modal =
        document.getElementById(
            "qrScannerModal"
        );


    modal.style.display =
        "flex";


    try {

        qrScanner =
            new Html5Qrcode(
                "qrReader"
            );


        await qrScanner.start(

            {
                facingMode:
                    "environment"
            },

            {
                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                }

            },

            decodedText => {

                const tracking =
                    extractTrackingNumber(
                        decodedText
                    );


                document.getElementById(
                    "checkoutTracking"
                ).value =
                    tracking;


                closeQrScanner();

            },

            errorMessage => {

                /*
                 * Scanner continuously reports
                 * frames without a QR code.
                 * We intentionally ignore these.
                 */

            }

        );

    }

    catch (error) {

        console.error(
            "QR scanner error:",
            error
        );


        alert(
            "Could not start the camera. You can enter the tracking number manually."
        );

        closeQrScanner();

    }

}


async function closeQrScanner() {

    const modal =
        document.getElementById(
            "qrScannerModal"
        );


    if (qrScanner) {

        try {

            if (
                qrScanner.isScanning
            ) {

                await qrScanner.stop();

            }

        }

        catch (e) {}

        try {

            await qrScanner.clear();

        }

        catch (e) {}

        qrScanner = null;

    }


    modal.style.display =
        "none";

}


/* =========================================================
   EXTRACT TRACKING NUMBER
========================================================= */

function extractTrackingNumber(
    value
) {

    let text =
        String(
            value ||
            ""
        ).trim();


    /*
     * If the QR contains an EcoTrack URL,
     * extract the tracking code from it.
     */

    try {

        const url =
            new URL(text);


        const parts =
            url.pathname
                .split("/")
                .filter(Boolean);


        if (
            parts.length > 0
        ) {

            const last =
                parts[
                    parts.length - 1
                ];


            if (
                last.toUpperCase()
                    .startsWith("ECP")
            ) {

                return last;

            }

        }

    }

    catch (e) {}


    return text;

}


/* =========================================================
   CONTINUOUS RETURN SCANNER

   Scans tracking QR codes back-to-back. Every code that
   matches an order marks that order as "Returned", which
   the backend uses to restore the exact products/variants
   from OrderItems back into stock exactly once.

   This does NOT touch cash - money was only added to the
   Money tab when the order became Delivered, so a return
   never removes money that was never added in the first
   place. Store profit is calculated from Delivered orders
   only, so a return simply stops that order from ever
   counting toward profit again (it already didn't, unless
   it had been Delivered previously).
========================================================= */

let returnScanner = null;
const returnScanCooldown = new Map(); // trackingNumber(lowercase) -> last attempt timestamp


function openReturnScanner() {

    document.getElementById(
        "returnScanLog"
    ).innerHTML = "";


    document.getElementById(
        "returnScannerModal"
    ).style.display =
        "flex";


    startReturnScanner();

}


async function startReturnScanner() {

    try {

        returnScanner =
            new Html5Qrcode(
                "returnQrReader"
            );


        await returnScanner.start(

            {
                facingMode:
                    "environment"
            },

            {
                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                }
            },

            decodedText =>
                handleReturnScan(
                    decodedText
                ),

            errorMessage => {

                /*
                 * Ignore per-frame "no QR code found"
                 * noise - this fires continuously while
                 * the camera is idle between codes.
                 */

            }

        );

    }

    catch (error) {

        console.error(
            "Return scanner error:",
            error
        );


        alert(
            "Could not start the camera for return scanning."
        );


        closeReturnScanner();

    }

}


async function closeReturnScanner() {

    if (returnScanner) {

        try {

            if (
                returnScanner.isScanning
            ) {

                await returnScanner.stop();

            }

        }

        catch (e) {}

        try {

            await returnScanner.clear();

        }

        catch (e) {}

        returnScanner = null;

    }


    returnScanCooldown.clear();


    document.getElementById(
        "returnScannerModal"
    ).style.display =
        "none";

}


function logReturnScan(message, type) {

    const log =
        document.getElementById(
            "returnScanLog"
        );


    if (!log)
        return;


    const entry =
        document.createElement("div");


    const bg =
        type === "success"
            ? "#ecfdf5"
            : type === "error"
                ? "#fef2f2"
                : "#f3f4f6";


    const color =
        type === "success"
            ? "var(--success)"
            : type === "error"
                ? "var(--danger)"
                : "#374151";


    const border =
        type === "success"
            ? "#a7f3d0"
            : type === "error"
                ? "#fecaca"
                : "#e5e7eb";


    entry.style.cssText = `
        padding:8px 10px;
        border-radius:6px;
        font-size:0.85rem;
        background:${bg};
        color:${color};
        border:1px solid ${border};
    `;


    entry.innerText =
        message;


    log.insertBefore(
        entry,
        log.firstChild
    );

}


async function handleReturnScan(decodedText) {

    const trackingNumber =
        extractTrackingNumber(
            decodedText
        );


    if (!trackingNumber)
        return;


    const key =
        trackingNumber.toLowerCase();


    const now =
        Date.now();


    const lastAttempt =
        returnScanCooldown.get(key);


    /*
     * The camera fires this callback on every frame
     * the same QR code is visible - debounce repeats
     * from a single physical scan.
     */

    if (
        lastAttempt &&
        now - lastAttempt < 4000
    ) {

        return;

    }


    returnScanCooldown.set(
        key,
        now
    );


    const order =
        allOrders.find(
            o =>
                String(
                    o.TrackingNumber || ""
                )
                    .trim()
                    .toLowerCase() === key
        );


    if (!order) {

        logReturnScan(
            `No order found for tracking ${trackingNumber}`,
            "error"
        );

        return;

    }


    if (order.Status === "Returned") {

        logReturnScan(
            `${trackingNumber} — already marked Returned`,
            "info"
        );

        return;

    }


    if (order.Status === "Cancelled") {

        logReturnScan(
            `${trackingNumber} — order was Cancelled, skipping`,
            "info"
        );

        return;

    }


    try {

        const response =
            await fetch(
                API_URL,
                {

                    method: "POST",

                    body:
                        JSON.stringify({

                            actionType:
                                "update_order_status",

                            orderId:
                                order.OrderId,

                            status:
                                "Returned"

                        }),

                    headers: {

                        "Content-Type":
                            "text/plain;charset=utf-8"

                    }

                }
            );


        const result =
            await response.json();


        if (
            result.status !==
            "success"
        ) {

            throw new Error(
                result.message ||
                "Failed to mark order as returned."
            );

        }


        logReturnScan(
            `✔ ${trackingNumber} — ${order.Products || "products"} restored to stock`,
            "success"
        );


        /*
         * Refresh in the background so stock, cash and
         * store totals stay in sync while scanning
         * continues uninterrupted.
         */

        loadData();

    }

    catch (error) {

        logReturnScan(
            `✘ ${trackingNumber} — ${error.message || "failed"}`,
            "error"
        );


        /*
         * Let a genuine failure be retried sooner than
         * the normal debounce window.
         */

        returnScanCooldown.delete(key);

    }

}


/* =========================================================
   CHECKOUT EVENTS
========================================================= */

function setupCheckoutEvents() {

    const sellingInput =
        document.getElementById(
            "checkoutSellingPrice"
        );


    const deliveryInput =
        document.getElementById(
            "checkoutDeliveryFee"
        );


    if (sellingInput) {

        sellingInput.addEventListener(
            "input",
            updateCheckoutSummary
        );

    }


    if (deliveryInput) {

        deliveryInput.addEventListener(
            "input",
            updateCheckoutSummary
        );

    }

}


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        setupCheckoutEvents();

        renderCheckoutItems();

    }
);
