/* =========================================================
   ECOTRACK - FIREBASE VERSION
========================================================= */

import {
    db,
    ensureFirebaseAuth
} from "./firebase.js";

import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    runTransaction,
    writeBatch
} from
    "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================================================
   COLLECTIONS
========================================================= */

const COLLECTIONS = {
    transactions: "transactions",
    stores: "stores",
    products: "products",
    ads: "ads",
    orders: "orders",
    orderItems: "orderItems"
};


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;

let firebaseUser = null;

let allTransactions = [];
let allStores = [];
let allProducts = [];
let allAds = [];
let allOrders = [];
let allOrderItems = [];

let activeStoreId = null;

let checkoutItems = [];

let qrScanner = null;

let returnScanner = null;

const returnScanCooldown = new Map();


/* =========================================================
   HELPERS
========================================================= */

function nowISO() {
    return new Date().toISOString();
}


function makeId(prefix = "") {

    if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
    ) {
        return prefix +
            window.crypto.randomUUID();
    }

    return prefix +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .substring(2, 10);
}


function number(value) {

    const n = parseFloat(value);

    return Number.isFinite(n)
        ? n
        : 0;
}


function cleanString(value) {

    return String(
        value === undefined ||
        value === null
            ? ""
            : value
    ).trim();
}


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


function parseAttributes(product) {

    if (!product) {
        return {};
    }

    if (
        product.Attributes &&
        typeof product.Attributes === "object"
    ) {
        return {
            ...product.Attributes
        };
    }

    try {

        return JSON.parse(
            product.Attributes || "{}"
        );

    } catch (error) {

        return {};
    }
}


function getProductTotalQty(product) {

    const directQty =
        parseFloat(product?.Qty);

    if (!isNaN(directQty)) {
        return directQty;
    }

    const attributes =
        parseAttributes(product);

    return Object.values(attributes)
        .reduce(
            (total, value) =>
                total + number(value),
            0
        );
}


function dataFromSnapshot(snapshot) {

    return snapshot.docs.map(item => ({
        ...item.data(),
        _id: item.id
    }));
}


function transactionToObject(data, id) {

    return {
        ...data,
        _id: id
    };
}


async function requireAuth() {

    firebaseUser =
        await ensureFirebaseAuth();

    if (!firebaseUser) {
        throw new Error(
            "Firebase authentication failed."
        );
    }

    return firebaseUser;
}


/* =========================================================
   USER
========================================================= */

async function selectUser(user) {

    currentUser = user;

    const navUser =
        document.getElementById("navUser");

    if (navUser) {
        navUser.innerText = user;
    }

    document
        .getElementById("userSelectPage")
        ?.classList.remove("active");

    document
        .getElementById("mainAppPage")
        ?.classList.add("active");

    await requireAuth();

    await loadData();
}


function switchUser() {

    currentUser = null;

    document
        .getElementById("mainAppPage")
        ?.classList.remove("active");

    document
        .getElementById("userSelectPage")
        ?.classList.add("active");
}


/* =========================================================
   TABS
========================================================= */

function switchTab(tabName) {

    document
        .querySelectorAll(".tab-btn")
        .forEach(btn =>
            btn.classList.remove("active")
        );

    document
        .querySelectorAll(".section-content")
        .forEach(sec =>
            sec.classList.remove("active")
        );

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
        ?.classList.add("active");

    document
        .getElementById(sectionId)
        ?.classList.add("active");

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
        document.getElementById(
            "category"
        )?.value;

    const profileGroup =
        document.getElementById(
            "profileGroup"
        );

    const profileInput =
        document.getElementById(
            "profile"
        );

    const profileLabel =
        document.getElementById(
            "profileLabel"
        );

    if (
        !profileGroup ||
        !profileInput ||
        !profileLabel
    ) {
        return;
    }

    if (category === "Private") {

        profileGroup.style.display =
            "block";

        profileLabel.innerText =
            "Private Profile:";

        profileInput.value =
            currentUser || "";

        profileInput.readOnly = true;

    }

    else if (category === "Debt") {

        profileGroup.style.display =
            "block";

        profileLabel.innerText =
            "Debt Person Name:";

        profileInput.value = "";

        profileInput.readOnly = false;

    }

    else {

        profileGroup.style.display =
            "none";

        profileInput.value = "";
    }
}


/* =========================================================
   LOAD DATA
========================================================= */

async function loadData() {

    try {

        await requireAuth();

        const [
            transactionsSnap,
            storesSnap,
            productsSnap,
            adsSnap,
            ordersSnap,
            orderItemsSnap
        ] = await Promise.all([

            getDocs(
                collection(
                    db,
                    COLLECTIONS.transactions
                )
            ),

            getDocs(
                collection(
                    db,
                    COLLECTIONS.stores
                )
            ),

            getDocs(
                collection(
                    db,
                    COLLECTIONS.products
                )
            ),

            getDocs(
                collection(
                    db,
                    COLLECTIONS.ads
                )
            ),

            getDocs(
                collection(
                    db,
                    COLLECTIONS.orders
                )
            ),

            getDocs(
                collection(
                    db,
                    COLLECTIONS.orderItems
                )
            )
        ]);


        allTransactions =
            dataFromSnapshot(
                transactionsSnap
            );

        allStores =
            dataFromSnapshot(
                storesSnap
            );

        allProducts =
            dataFromSnapshot(
                productsSnap
            );

        allAds =
            dataFromSnapshot(
                adsSnap
            );

        allOrders =
            dataFromSnapshot(
                ordersSnap
            );

        allOrderItems =
            dataFromSnapshot(
                orderItemsSnap
            );


        /*
         * Newest first.
         */

        allTransactions.sort(
            (a, b) =>
                new Date(
                    b.Timestamp || 0
                ) -
                new Date(
                    a.Timestamp || 0
                )
        );

        allOrders.sort(
            (a, b) =>
                new Date(
                    b.Timestamp || 0
                ) -
                new Date(
                    a.Timestamp || 0
                )
        );


        calculateMoney();

        renderStoresList();
        renderCheckoutStores();
        renderOrdersList();

        if (activeStoreId) {
            renderStoreDetail(
                activeStoreId
            );
        }

    }

    catch (error) {

        console.error(
            "Firebase load error:",
            error
        );

        alert(
            "Could not load Firebase data.\n\n" +
            error.message
        );
    }
}


/* =========================================================
   MONEY CALCULATION
========================================================= */

function calculateMoney() {

    let totalCash = 0;

    let totalDebt = 0;

    let privateI = 0;

    let privateN = 0;

    const debtProfiles = {};


    allTransactions.forEach(row => {

        const amount =
            number(row.Amount);

        const action =
            cleanString(row.Action);

        const category =
            cleanString(row.Category);

        const profile =
            cleanString(row.Profile);


        if (category === "Work") {

            if (action === "Add") {
                totalCash += amount;
            }

            if (action === "Remove") {
                totalCash -= amount;
            }
        }


        else if (
            category === "Private"
        ) {

            if (action === "Add") {

                totalCash += amount;

                if (profile === "I") {
                    privateI += amount;
                }

                if (profile === "N") {
                    privateN += amount;
                }
            }

            if (action === "Remove") {

                totalCash -= amount;

                if (profile === "I") {
                    privateI -= amount;
                }

                if (profile === "N") {
                    privateN -= amount;
                }
            }
        }


        else if (
            category === "Debt"
        ) {

            if (!profile) {
                return;
            }

            if (!debtProfiles[profile]) {
                debtProfiles[profile] = 0;
            }

            if (action === "Add") {

                /*
                 * Debt increases cash.
                 */
                totalCash += amount;

                /*
                 * Debt also increases debt.
                 */
                totalDebt += amount;

                debtProfiles[profile] +=
                    amount;
            }

            if (action === "Remove") {

                totalCash -= amount;

                totalDebt -= amount;

                debtProfiles[profile] -=
                    amount;
            }
        }
    });


    /*
     * Remove fully settled profiles.
     */

    Object.keys(debtProfiles)
        .forEach(name => {

            if (
                Math.abs(
                    debtProfiles[name]
                ) < 0.005
            ) {
                delete debtProfiles[name];
            }
        });


    const totalNetMoney =
        totalCash - totalDebt;


    document.getElementById(
        "totalCash"
    )?.replaceChildren(
        document.createTextNode(
            `$${totalCash.toFixed(2)}`
        )
    );

    document.getElementById(
        "totalDebt"
    )?.replaceChildren(
        document.createTextNode(
            `$${totalDebt.toFixed(2)}`
        )
    );

    document.getElementById(
        "totalNetMoney"
    )?.replaceChildren(
        document.createTextNode(
            `$${totalNetMoney.toFixed(2)}`
        )
    );

    document.getElementById(
        "privateI"
    )?.replaceChildren(
        document.createTextNode(
            `$${privateI.toFixed(2)}`
        )
    );

    document.getElementById(
        "privateN"
    )?.replaceChildren(
        document.createTextNode(
            `$${privateN.toFixed(2)}`
        )
    );


    renderTransactionHistory();

    renderDebtProfiles(
        debtProfiles
    );
}


/* =========================================================
   TRANSACTION HISTORY
========================================================= */

function renderTransactionHistory() {

    const historyList =
        document.getElementById(
            "historyList"
        );

    if (!historyList) {
        return;
    }

    historyList.innerHTML = "";

    const now =
        Date.now();


    allTransactions.forEach(row => {

        const amount =
            number(row.Amount);

        const action =
            cleanString(row.Action);

        const category =
            cleanString(row.Category);

        const profile =
            cleanString(row.Profile);

        const timestamp =
            row.Timestamp;

        const txTime =
            new Date(
                timestamp
            ).getTime();

        const diffMinutes =
            (now - txTime) /
            (1000 * 60);


        let cancelBtnHtml = "";


        /*
         * Transaction can be deleted for
         * 30 minutes after creation.
         */

        if (
            !isNaN(diffMinutes) &&
            diffMinutes >= 0 &&
            diffMinutes <= 30
        ) {

            cancelBtnHtml = `
                <button
                    onclick="
                        cancelTransaction(
                            '${escapeJs(row._id)}'
                        )
                    "
                    class="cancel-btn">
                    Cancel / Delete
                </button>
            `;
        }


        const li =
            document.createElement("li");

        li.className =
            action.toLowerCase();


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
                ${new Date(
                    timestamp
                ).toLocaleString()}
            </small>

            ${
                row.Notes
                    ? `
                    <small>
                        ${escapeHtml(
                            row.Notes
                        )}
                    </small>
                    `
                    : ""
            }

            ${cancelBtnHtml}
        `;


        historyList.appendChild(li);
    });
}


/* =========================================================
   DEBT PROFILES
========================================================= */

function renderDebtProfiles(
    debtProfiles
) {

    const container =
        document.getElementById(
            "debtProfilesContainer"
        );

    if (!container) {
        return;
    }

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
            () =>
                openDebtProfile(
                    name
                );


        card.innerHTML = `
            <h4>
                ${escapeHtml(name)}
            </h4>

            <p
                style="
                    color:
                    ${
                        balance >= 0
                            ? "var(--success)"
                            : "var(--danger)"
                    };
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
   PRIVATE PROFILE
========================================================= */

function openProfile(profileName) {

    const actionContainer =
        document.getElementById(
            "modalActionContainer"
        );

    if (actionContainer) {
        actionContainer.innerHTML = "";
    }


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

function openDebtProfile(
    profileName
) {

    const modalActionContainer =
        document.getElementById(
            "modalActionContainer"
        );

    if (!modalActionContainer) {
        return;
    }


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
                    min="0"
                    style="
                        flex:1;
                        padding:8px;
                        border-radius:6px;
                        border:1px solid #d1d5db;
                    ">
            </div>


            <button
                onclick="
                    submitModalDebt(
                        '${escapeJs(profileName)}'
                    )
                "
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
            cleanString(row.Profile) ===
                profileName
    );
}


async function submitModalDebt(
    profileName
) {

    const action =
        document.getElementById(
            "modalActionType"
        )?.value;

    const amount =
        number(
            document.getElementById(
                "modalAmount"
            )?.value
        );


    if (amount <= 0) {

        alert(
            "Please enter a valid amount."
        );

        return;
    }


    try {

        await addTransaction(
            currentUser,
            action,
            amount,
            "Debt",
            profileName,
            ""
        );

        await loadData();

        openDebtProfile(
            profileName
        );

    }

    catch (error) {

        alert(
            error.message ||
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


    if (!modal) {
        return;
    }


    if (modalTitle) {
        modalTitle.innerText =
            titleText;
    }

    if (modalHistoryList) {

        modalHistoryList.innerHTML = "";


        const filteredTransactions =
            allTransactions.filter(
                filterCondition
            );


        if (
            filteredTransactions.length ===
            0
        ) {

            modalHistoryList.innerHTML =
                "<li>No transactions found for this profile.</li>";

        }

        else {

            filteredTransactions.forEach(
                row => {

                    const li =
                        document.createElement(
                            "li"
                        );

                    li.className =
                        cleanString(
                            row.Action
                        ).toLowerCase();


                    li.innerHTML = `
                        <strong>
                            ${escapeHtml(
                                row.Action
                            )}
                            $${number(
                                row.Amount
                            ).toFixed(2)}
                        </strong>

                        <small>
                            Done by:
                            ${escapeHtml(
                                row.User || ""
                            )}
                            |
                            ${new Date(
                                row.Timestamp
                            ).toLocaleString()}
                        </small>

                        ${
                            row.Notes
                                ? `
                                <small>
                                    ${escapeHtml(
                                        row.Notes
                                    )}
                                </small>
                                `
                                : ""
                        }
                    `;


                    modalHistoryList
                        .appendChild(li);
                }
            );
        }
    }


    modal.style.display =
        "flex";
}


function closeModal() {

    const modal =
        document.getElementById(
            "profileModal"
        );

    if (modal) {
        modal.style.display =
            "none";
    }
}


/* =========================================================
   TRANSACTION
========================================================= */

async function addTransaction(
    user,
    action,
    amount,
    category,
    profile = "",
    notes = ""
) {

    await requireAuth();


    const value =
        number(amount);


    if (
        value <= 0
    ) {
        throw new Error(
            "Amount must be greater than zero."
        );
    }


    if (
        action !== "Add" &&
        action !== "Remove"
    ) {
        throw new Error(
            "Invalid transaction action."
        );
    }


    if (
        category !== "Work" &&
        category !== "Private" &&
        category !== "Debt"
    ) {
        throw new Error(
            "Invalid transaction category."
        );
    }


    if (
        category === "Private" &&
        !profile
    ) {
        throw new Error(
            "Private profile is required."
        );
    }


    if (
        category === "Debt" &&
        !profile
    ) {
        throw new Error(
            "Debt person's name is required."
        );
    }


    const transactionId =
        makeId("TX-");


    await setDoc(
        doc(
            db,
            COLLECTIONS.transactions,
            transactionId
        ),
        {
            Timestamp:
                nowISO(),

            User:
                user || "",

            Action:
                action,

            Amount:
                value,

            Category:
                category,

            Profile:
                profile || "",

            Notes:
                notes || ""
        }
    );


    return transactionId;
}


/* =========================================================
   DELETE TRANSACTION
========================================================= */

async function cancelTransaction(
    transactionId
) {

    if (
        !confirm(
            "Are you sure you want to cancel and delete this transaction?"
        )
    ) {
        return;
    }


    try {

        await requireAuth();


        const txRef =
            doc(
                db,
                COLLECTIONS.transactions,
                transactionId
            );


        const txSnap =
            await getDoc(txRef);


        if (!txSnap.exists()) {
            throw new Error(
                "Transaction not found."
            );
        }


        const tx =
            txSnap.data();


        const created =
            new Date(
                tx.Timestamp
            ).getTime();


        const ageMinutes =
            (
                Date.now() -
                created
            ) /
            (1000 * 60);


        if (
            ageMinutes < 0 ||
            ageMinutes > 30
        ) {
            throw new Error(
                "This transaction can only be deleted within 30 minutes."
            );
        }


        await deleteDoc(
            txRef
        );


        await loadData();

    }

    catch (error) {

        alert(
            error.message ||
            "Failed to delete transaction."
        );
    }
}


/* =========================================================
   MONEY FORM
========================================================= */

function setupMoneyForm() {

    const form =
        document.getElementById(
            "transactionForm"
        );

    if (!form) {
        return;
    }


    form.addEventListener(
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


            if (btn) {
                btn.disabled = true;
                btn.innerText =
                    "Saving...";
            }


            const category =
                document.getElementById(
                    "category"
                ).value;


            let profileVal =
                document.getElementById(
                    "profile"
                ).value;


            if (
                category === "Private"
            ) {
                profileVal =
                    currentUser;
            }


            const amount =
                number(
                    document.getElementById(
                        "amount"
                    ).value
                );


            try {

                await addTransaction(
                    currentUser,

                    document.getElementById(
                        "action"
                    ).value,

                    amount,

                    category,

                    profileVal,

                    ""
                );


                if (status) {

                    status.innerText =
                        "Saved successfully!";

                    status.style.color =
                        "green";
                }


                form.reset();

                handleCategoryChange();

                await loadData();

            }

            catch (error) {

                if (status) {

                    status.innerText =
                        error.message ||
                        "Error saving transaction.";

                    status.style.color =
                        "red";
                }

            }

            finally {

                if (btn) {

                    btn.disabled = false;

                    btn.innerText =
                        "Save Transaction";
                }


                setTimeout(
                    () => {

                        if (status) {
                            status.innerText =
                                "";
                        }

                    },
                    3000
                );
            }
        }
    );
}


/* =========================================================
   STORES
========================================================= */

async function createStore() {

    const nameInput =
        document.getElementById(
            "newStoreName"
        );

    if (!nameInput) {
        return;
    }


    const storeName =
        nameInput.value.trim();


    if (!storeName) {

        alert(
            "Store name is required."
        );

        return;
    }


    try {

        await requireAuth();


        const storeId =
            makeId("STORE-");


        await setDoc(
            doc(
                db,
                COLLECTIONS.stores,
                storeId
            ),
            {
                StoreId:
                    storeId,

                StoreName:
                    storeName
            }
        );


        nameInput.value = "";


        await loadData();

    }

    catch (error) {

        alert(
            error.message ||
            "Failed to create store."
        );
    }
}


function renderStoresList() {

    const container =
        document.getElementById(
            "storesContainer"
        );

    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (
        allStores.length === 0
    ) {

        container.innerHTML = `
            <small
                style="color:var(--text-muted);">
                No stores created yet.
            </small>
        `;

        return;
    }


    allStores.forEach(store => {

        const div =
            document.createElement(
                "div"
            );


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
                ${escapeHtml(
                    store.StoreName
                )}
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


    const storesContainer =
        document.getElementById(
            "storesContainer"
        );


    if (
        storesContainer &&
        storesContainer.parentElement
    ) {

        storesContainer.parentElement
            .style.display =
                "none";
    }


    document.getElementById(
        "storeDetailView"
    ).style.display =
        "block";


    renderStoreDetail(
        storeId
    );
}


function backToStores() {

    activeStoreId =
        null;


    document.getElementById(
        "storeDetailView"
    ).style.display =
        "none";


    const storesContainer =
        document.getElementById(
            "storesContainer"
        );


    if (
        storesContainer &&
        storesContainer.parentElement
    ) {

        storesContainer.parentElement
            .style.display =
                "block";
    }
}


/* =========================================================
   STORE DETAIL
========================================================= */

function renderStoreDetail(
    storeId
) {

    const storeProducts =
        allProducts.filter(
            p =>
                String(p.StoreId) ===
                String(storeId)
        );


    const storeAdsList =
        allAds.filter(
            a =>
                String(a.StoreId) ===
                String(storeId)
        );


    let capital = 0;

    let totalAdSpend = 0;

    let totalCorruptedLoss = 0;


    storeProducts.forEach(product => {

        const qty =
            getProductTotalQty(
                product
            );


        capital +=
            number(product.Cost) *
            qty;
    });


    allTransactions.forEach(tx => {

        if (
            cleanString(tx.Notes)
                .includes(
                    "Corrupted Stock Loss"
                )
        ) {

            const matchingProduct =
                storeProducts.some(
                    product =>
                        cleanString(
                            tx.Notes
                        ).includes(
                            cleanString(
                                product.Name
                            )
                        )
                );


            if (matchingProduct) {

                totalCorruptedLoss +=
                    number(tx.Amount);
            }
        }
    });


    storeAdsList.forEach(ad => {

        totalAdSpend +=
            number(ad.Amount);
    });


    let deliveredOrdersProfit = 0;


    allOrders
        .filter(
            order =>
                String(order.StoreId) ===
                    String(storeId) &&
                order.Status ===
                    "Delivered"
        )
        .forEach(order => {

            deliveredOrdersProfit +=
                number(order.Profit);
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


    if (!prodListContainer) {
        return;
    }


    prodListContainer.innerHTML = "";


    if (
        storeProducts.length === 0
    ) {

        prodListContainer.innerHTML = `
            <small
                style="color:var(--text-muted);">
                No products in this store.
            </small>
        `;

        return;
    }


    storeProducts.forEach(
        prod => {

            const attributesObj =
                parseAttributes(
                    prod
                );


            let attrHtml = "";


            Object.keys(
                attributesObj
            ).forEach(key => {

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
                                ${escapeHtml(
                                    key
                                )}
                            </strong>:

                            ${number(
                                attributesObj[key]
                            )}

                        </span>


                        <div
                            style="
                                display:flex;
                                gap:4px;
                            ">

                            <button
                                onclick="
                                    adjustVariantInline(
                                        '${escapeJs(
                                            prod.ProductId
                                        )}',
                                        '${escapeJs(
                                            key
                                        )}',
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
                                ">
                                +
                            </button>


                            <button
                                onclick="
                                    adjustVariantInline(
                                        '${escapeJs(
                                            prod.ProductId
                                        )}',
                                        '${escapeJs(
                                            key
                                        )}',
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
                                ">
                                -
                            </button>


                            <button
                                onclick="
                                    adjustVariantInline(
                                        '${escapeJs(
                                            prod.ProductId
                                        )}',
                                        '${escapeJs(
                                            key
                                        )}',
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
                                ">
                                🗑️
                            </button>

                        </div>

                    </div>
                `;
            });


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


            const displayQty =
                getProductTotalQty(
                    prod
                );


            const card =
                document.createElement(
                    "div"
                );


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

                            ${escapeHtml(
                                prod.Name
                            )}

                        </strong>

                        <br>

                        <small
                            style="
                                color:#4b5563;
                            ">

                            Unit Cost:
                            $${number(
                                prod.Cost
                            ).toFixed(2)}

                            |

                            Total Stock Qty:

                            <strong>
                                ${displayQty}
                            </strong>

                        </small>

                    </div>


                    <button
                        onclick="
                            editProduct(
                                '${escapeJs(
                                    prod.ProductId
                                )}'
                            )
                        "
                        style="
                            background:var(--primary);
                            color:white;
                            border:none;
                            padding:6px 10px;
                            border-radius:4px;
                            cursor:pointer;
                        ">

                        Edit Info

                    </button>

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
                        id="newVarName_${escapeJs(
                            prod.ProductId
                        )}"
                        placeholder="New variant (e.g. Blue)"
                        style="
                            flex:2;
                            padding:6px;
                            border:1px solid #d1d5db;
                            border-radius:4px;
                        ">


                    <input
                        type="number"
                        id="newVarQty_${escapeJs(
                            prod.ProductId
                        )}"
                        placeholder="Qty"
                        value="1"
                        min="1"
                        style="
                            flex:1;
                            padding:6px;
                            border:1px solid #d1d5db;
                            border-radius:4px;
                        ">


                    <button
                        onclick="
                            addNewVariantInline(
                                '${escapeJs(
                                    prod.ProductId
                                )}'
                            )
                        "
                        style="
                            background:var(--success);
                            color:white;
                            border:none;
                            padding:6px 12px;
                            border-radius:4px;
                            font-weight:bold;
                            cursor:pointer;
                        ">

                        Add

                    </button>

                </div>
            `;


            prodListContainer
                .appendChild(card);
        }
    );
}


/* =========================================================
   PRODUCT MODAL
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
    )?.reset();


    document.getElementById(
        "productModal"
    ).style.display =
        "flex";
}


function editProduct(
    productId
) {

    const prod =
        allProducts.find(
            p =>
                String(p.ProductId) ===
                String(productId)
        );


    if (!prod) {
        return;
    }


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


    const name =
        document.getElementById(
            "prodName"
        ).value.trim();


    const cost =
        number(
            document.getElementById(
                "prodCost"
            ).value
        );


    if (!name) {

        alert(
            "Product name is required."
        );

        return;
    }


    if (cost < 0) {

        alert(
            "Product cost cannot be negative."
        );

        return;
    }


    try {

        await requireAuth();


        if (editId) {

            const productRef =
                doc(
                    db,
                    COLLECTIONS.products,
                    editId
                );


            await updateDoc(
                productRef,
                {
                    Name: name,
                    Cost: cost
                }
            );

        }

        else {

            if (!activeStoreId) {

                throw new Error(
                    "Please open a store first."
                );
            }


            const productId =
                makeId("PROD-");


            await setDoc(
                doc(
                    db,
                    COLLECTIONS.products,
                    productId
                ),
                {
                    ProductId:
                        productId,

                    StoreId:
                        activeStoreId,

                    Name:
                        name,

                    Cost:
                        cost,

                    Qty:
                        0,

                    Attributes:
                        {}
                }
            );
        }


        closeProductModal();

        document.getElementById(
            "productForm"
        )?.reset();


        await loadData();

    }

    catch (error) {

        alert(
            error.message ||
            "Failed to save product."
        );
    }
}


/* =========================================================
   ADD VARIANT
========================================================= */

async function addNewVariantInline(
    productId
) {

    const nameInput =
        document.getElementById(
            `newVarName_${productId}`
        );

    const qtyInput =
        document.getElementById(
            `newVarQty_${productId}`
        );


    const variantName =
        nameInput?.value.trim();


    const variantQty =
        number(
            qtyInput?.value
        );


    if (
        !variantName ||
        variantQty <= 0
    ) {

        alert(
            "Please enter a valid variation name and quantity."
        );

        return;
    }


    try {

        await updateProductVariant(
            productId,
            variantName,
            variantQty
        );

        await loadData();

    }

    catch (error) {

        alert(
            error.message ||
            "Failed to add variation."
        );
    }
}


async function updateProductVariant(
    productId,
    variantName,
    variantQty
) {

    await requireAuth();


    const productRef =
        doc(
            db,
            COLLECTIONS.products,
            productId
        );


    await runTransaction(
        db,
        async transaction => {

            const snapshot =
                await transaction.get(
                    productRef
                );


            if (!snapshot.exists()) {

                throw new Error(
                    "Product not found."
                );
            }


            const product =
                snapshot.data();


            const attributes = {
                ...parseAttributes(
                    product
                )
            };


            attributes[variantName] =
                number(
                    attributes[
                        variantName
                    ]
                ) +
                variantQty;


            const totalQty =
                Object.values(
                    attributes
                ).reduce(
                    (total, value) =>
                        total +
                        number(value),
                    0
                );


            transaction.update(
                productRef,
                {
                    Qty:
                        totalQty,

                    Attributes:
                        attributes
                }
            );


            const txId =
                makeId("TX-");


            transaction.set(
                doc(
                    db,
                    COLLECTIONS.transactions,
                    txId
                ),
                {
                    Timestamp:
                        nowISO(),

                    User:
                        currentUser || "",

                    Action:
                        "Remove",

                    Amount:
                        number(product.Cost) *
                        variantQty,

                    Category:
                        "Work",

                    Profile:
                        "",

                    Notes:
                        "Purchased Stock (" +
                        variantName +
                        ": +" +
                        variantQty +
                        "): " +
                        product.Name
                }
            );
        }
    );
}


/* =========================================================
   STOCK ADJUSTMENT
========================================================= */

async function adjustVariantInline(
    productId,
    variantName,
    defaultStep,
    mode
) {

    let message =
        `Modify quantity for ${variantName}:`;


    if (mode === "reduce") {

        message =
            `Reduce stock for ${variantName} (without counting as financial loss):`;
    }


    if (mode === "loss") {

        message =
            `Mark corrupted stock/loss for ${variantName}:`;
    }


    const qtyStr =
        prompt(
            message,
            Math.abs(defaultStep)
        );


    if (!qtyStr) {
        return;
    }


    const value =
        number(qtyStr);


    if (value <= 0) {
        return;
    }


    try {

        if (mode === "loss") {

            await changeStock(
                productId,
                variantName,
                -value,
                "loss"
            );

        }

        else {

            await changeStock(
                productId,
                variantName,
                mode === "add"
                    ? value
                    : -value,
                "normal"
            );
        }


        await loadData();

    }

    catch (error) {

        alert(
            error.message ||
            "Failed to change stock."
        );
    }
}


async function changeStock(
    productId,
    variantName,
    changeQty,
    mode
) {

    await requireAuth();


    const productRef =
        doc(
            db,
            COLLECTIONS.products,
            productId
        );


    await runTransaction(
        db,
        async transaction => {

            const snapshot =
                await transaction.get(
                    productRef
                );


            if (!snapshot.exists()) {

                throw new Error(
                    "Product not found."
                );
            }


            const product =
                snapshot.data();


            const cost =
                number(product.Cost);


            const attributes =
                parseAttributes(
                    product
                );


            const hasVariants =
                Object.keys(
                    attributes
                ).length > 0;


            if (hasVariants) {

                if (!variantName) {

                    throw new Error(
                        "Variant is required."
                    );
                }


                const oldQty =
                    number(
                        attributes[
                            variantName
                        ]
                    );


                if (
                    changeQty < 0 &&
                    oldQty +
                    changeQty < 0
                ) {

                    throw new Error(
                        "Stock cannot become negative."
                    );
                }


                const newQty =
                    oldQty +
                    changeQty;


                if (newQty <= 0) {

                    delete attributes[
                        variantName
                    ];

                }

                else {

                    attributes[
                        variantName
                    ] = newQty;
                }


                const totalQty =
                    Object.values(
                        attributes
                    ).reduce(
                        (total, value) =>
                            total +
                            number(value),
                        0
                    );


                transaction.update(
                    productRef,
                    {
                        Qty:
                            totalQty,

                        Attributes:
                            attributes
                    }
                );


                const txId =
                    makeId("TX-");


                if (mode === "loss") {

                    transaction.set(
                        doc(
                            db,
                            COLLECTIONS.transactions,
                            txId
                        ),
                        {
                            Timestamp:
                                nowISO(),

                            User:
                                currentUser || "",

                            Action:
                                "Remove",

                            Amount:
                                cost *
                                Math.abs(
                                    changeQty
                                ),

                            Category:
                                "Work",

                            Profile:
                                "",

                            Notes:
                                "Corrupted Stock Loss (" +
                                Math.abs(
                                    changeQty
                                ) +
                                "x " +
                                variantName +
                                "): " +
                                product.Name
                        }
                    );

                }

                else {

                    transaction.set(
                        doc(
                            db,
                            COLLECTIONS.transactions,
                            txId
                        ),
                        {
                            Timestamp:
                                nowISO(),

                            User:
                                currentUser || "",

                            Action:
                                changeQty > 0
                                    ? "Remove"
                                    : "Add",

                            Amount:
                                cost *
                                Math.abs(
                                    changeQty
                                ),

                            Category:
                                "Work",

                            Profile:
                                "",

                            Notes:
                                (
                                    changeQty > 0
                                        ? "Added Stock ("
                                        : "Reduced Stock / Return ("
                                ) +
                                variantName +
                                ": " +
                                changeQty +
                                "): " +
                                product.Name
                        }
                    );
                }

                return;
            }


            /*
             * Product without variants.
             */

            const oldQty =
                number(product.Qty);


            if (
                oldQty +
                changeQty <
                0
            ) {

                throw new Error(
                    "Stock cannot become negative."
                );
            }


            transaction.update(
                productRef,
                {
                    Qty:
                        oldQty +
                        changeQty
                }
            );


            const txId =
                makeId("TX-");


            transaction.set(
                doc(
                    db,
                    COLLECTIONS.transactions,
                    txId
                ),
                {
                    Timestamp:
                        nowISO(),

                    User:
                        currentUser || "",

                    Action:
                        mode === "loss"
                            ? "Remove"
                            : (
                                changeQty > 0
                                    ? "Remove"
                                    : "Add"
                            ),

                    Amount:
                        cost *
                        Math.abs(
                            changeQty
                        ),

                    Category:
                        "Work",

                    Profile:
                        "",

                    Notes:
                        mode === "loss"

                            ? "Corrupted Stock Loss (" +
                              Math.abs(changeQty) +
                              "x): " +
                              product.Name

                            : (
                                changeQty > 0
                                    ? "Added Stock: "
                                    : "Reduced Stock / Return: "
                            ) +
                            product.Name
                }
            );
        }
    );
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


    if (!activeStoreId) {

        alert(
            "Please open a store first."
        );

        return;
    }


    const amount =
        number(
            document.getElementById(
                "adAmount"
            ).value
        );


    const notes =
        document.getElementById(
            "adNotes"
        ).value.trim();


    if (amount <= 0) {

        alert(
            "Ad amount must be greater than zero."
        );

        return;
    }


    try {

        await requireAuth();


        const batch =
            writeBatch(db);


        const adId =
            makeId("AD-");


        batch.set(
            doc(
                db,
                COLLECTIONS.ads,
                adId
            ),
            {
                AdId:
                    adId,

                StoreId:
                    activeStoreId,

                Amount:
                    amount,

                Timestamp:
                    nowISO(),

                Notes:
                    notes
            }
        );


        const transactionId =
            makeId("TX-");


        batch.set(
            doc(
                db,
                COLLECTIONS.transactions,
                transactionId
            ),
            {
                Timestamp:
                    nowISO(),

                User:
                    currentUser || "",

                Action:
                    "Remove",

                Amount:
                    amount,

                Category:
                    "Work",

                Profile:
                    "",

                Notes:
                    "Ad Expense for Store ID " +
                    activeStoreId +
                    (
                        notes
                            ? " | " + notes
                            : ""
                    )
            }
        );


        await batch.commit();


        closeAdModal();


        document.getElementById(
            "adForm"
        )?.reset();


        await loadData();

    }

    catch (error) {

        alert(
            error.message ||
            "Failed to save advertisement."
        );
    }
}


/* =========================================================
   CHECKOUT STORE
========================================================= */

function renderCheckoutStores() {

    const select =
        document.getElementById(
            "checkoutStore"
        );

    if (!select) {
        return;
    }


    const currentValue =
        select.value;


    select.innerHTML = `
        <option value="">
            Select a store
        </option>
    `;


    allStores.forEach(store => {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            store.StoreId;


        option.textContent =
            store.StoreName;


        select.appendChild(
            option
        );
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
        )?.value;


    const productSelect =
        document.getElementById(
            "checkoutProduct"
        );


    const variantSelect =
        document.getElementById(
            "checkoutVariant"
        );


    if (!productSelect) {
        return;
    }


    productSelect.innerHTML = `
        <option value="">
            Select product
        </option>
    `;


    if (variantSelect) {

        variantSelect.innerHTML = `
            <option value="">
                No variation
            </option>
        `;
    }


    if (!storeId) {
        return;
    }


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
        )?.value;


    const variantSelect =
        document.getElementById(
            "checkoutVariant"
        );


    if (!variantSelect) {
        return;
    }


    variantSelect.innerHTML = `
        <option value="">
            No variation
        </option>
    `;


    if (!productId) {
        return;
    }


    const product =
        allProducts.find(
            p =>
                String(p.ProductId) ===
                String(productId)
        );


    if (!product) {
        return;
    }


    const attributes =
        parseAttributes(
            product
        );


    Object.keys(attributes)
        .forEach(variant => {

            const qty =
                number(
                    attributes[variant]
                );


            if (qty <= 0) {
                return;
            }


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
   ADD PRODUCT TO CHECKOUT
========================================================= */

function addCheckoutProduct() {

    const productId =
        document.getElementById(
            "checkoutProduct"
        )?.value;


    const variant =
        document.getElementById(
            "checkoutVariant"
        )?.value || "";


    const quantity =
        number(
            document.getElementById(
                "checkoutQuantity"
            )?.value
        );


    if (!productId) {

        alert(
            "Please select a product."
        );

        return;
    }


    if (quantity <= 0) {

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


    if (!product) {
        return;
    }


    let availableQty = 0;


    if (variant) {

        const attributes =
            parseAttributes(
                product
            );


        availableQty =
            number(
                attributes[variant]
            );

    }

    else {

        availableQty =
            getProductTotalQty(
                product
            );
    }


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
                number(product.Cost)
        });
    }


    renderCheckoutItems();
}


/* =========================================================
   REMOVE CHECKOUT PRODUCT
========================================================= */

function removeCheckoutProduct(
    index
) {

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


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (
        checkoutItems.length ===
        0
    ) {

        container.innerHTML = `
            <small
                style="
                    color:var(--text-muted);
                ">
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
                    ? ` — ${escapeHtml(
                        item.variant
                    )}`
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
        number(
            document.getElementById(
                "checkoutSellingPrice"
            )?.value
        );


    const deliveryFee =
        number(
            document.getElementById(
                "checkoutDeliveryFee"
            )?.value
        );


    const customerTotal =
        sellingPrice +
        deliveryFee;


    const profit =
        sellingPrice -
        totalCost;


    const elements = {

        checkoutCost:
            `$${totalCost.toFixed(2)}`,

        checkoutSell:
            `$${sellingPrice.toFixed(2)}`,

        checkoutDelivery:
            `$${deliveryFee.toFixed(2)}`,

        checkoutCustomerTotal:
            `$${customerTotal.toFixed(2)}`,

        checkoutProfit:
            `$${profit.toFixed(2)}`
    };


    Object.keys(elements)
        .forEach(id => {

            const element =
                document.getElementById(id);

            if (element) {

                element.innerText =
                    elements[id];
            }
        });


    const profitElement =
        document.getElementById(
            "checkoutProfit"
        );


    if (profitElement) {

        profitElement.style.color =
            profit >= 0
                ? "var(--success)"
                : "var(--danger)";
    }
}


/* =========================================================
   CREATE ORDER
========================================================= */

async function createCheckoutOrder() {

    if (
        checkoutItems.length ===
        0
    ) {

        alert(
            "Add at least one product."
        );

        return;
    }


    const storeId =
        document.getElementById(
            "checkoutStore"
        )?.value;


    const sellingPrice =
        parseFloat(
            document.getElementById(
                "checkoutSellingPrice"
            )?.value
        );


    const deliveryFee =
        number(
            document.getElementById(
                "checkoutDeliveryFee"
            )?.value
        );


    const trackingNumber =
        document.getElementById(
            "checkoutTracking"
        )?.value.trim();


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


    const status =
        document.getElementById(
            "checkoutStatus"
        );


    if (btn) {

        btn.disabled = true;

        btn.innerText =
            "Creating Order...";
    }


    try {

        await requireAuth();


        const result =
            await createOrderFirestore({

                storeId,

                items:
                    checkoutItems.map(
                        item => ({
                            productId:
                                item.productId,

                            variant:
                                item.variant,

                            quantity:
                                item.quantity
                        })
                    ),

                sellingPrice,

                deliveryFee,

                trackingNumber
            });


        if (status) {

            status.innerText =
                "Order created successfully!";

            status.style.color =
                "var(--success)";
        }


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


        if (status) {

            status.innerText =
                error.message ||
                "Failed to create order.";

            status.style.color =
                "var(--danger)";
        }

        else {

            alert(
                error.message ||
                "Failed to create order."
            );
        }

    }

    finally {

        if (btn) {

            btn.disabled = false;

            btn.innerText =
                "Create Order";
        }
    }
}


/* =========================================================
   FIRESTORE CREATE ORDER
========================================================= */

async function createOrderFirestore(
    data
) {

    const storeId =
        cleanString(
            data.storeId
        );


    const trackingNumber =
        cleanString(
            data.trackingNumber
        );


    const sellingPrice =
        number(
            data.sellingPrice
        );


    const deliveryFee =
        number(
            data.deliveryFee
        );


    const items =
        Array.isArray(
            data.items
        )
            ? data.items
            : [];


    if (!storeId) {

        throw new Error(
            "Please select a store."
        );
    }


    if (!trackingNumber) {

        throw new Error(
            "Tracking number is required."
        );
    }


    if (sellingPrice < 0) {

        throw new Error(
            "Invalid selling price."
        );
    }


    if (deliveryFee < 0) {

        throw new Error(
            "Invalid delivery fee."
        );
    }


    if (
        items.length === 0
    ) {

        throw new Error(
            "Add at least one product."
        );
    }


    const orderId =
        makeId("ORD-");


    const timestamp =
        nowISO();


    const orderRef =
        doc(
            db,
            COLLECTIONS.orders,
            orderId
        );


    const trackingQuery =
        query(
            collection(
                db,
                COLLECTIONS.orders
            ),
            where(
                "TrackingNumber",
                "==",
                trackingNumber
            )
        );


    return runTransaction(
        db,
        async transaction => {

            /*
             * READ PHASE
             */

            const storeRef =
                doc(
                    db,
                    COLLECTIONS.stores,
                    storeId
                );


            const storeSnap =
                await transaction.get(
                    storeRef
                );


            if (!storeSnap.exists()) {

                throw new Error(
                    "Store not found."
                );
            }


            const store =
                storeSnap.data();


            /*
             * Check tracking number.
             */

            const existingTracking =
                await getDocs(
                    trackingQuery
                );


            if (
                !existingTracking.empty
            ) {

                throw new Error(
                    "This tracking number already exists."
                );
            }


            /*
             * Group duplicate products.
             */

            const requested =
                new Map();


            items.forEach(item => {

                const productId =
                    cleanString(
                        item.productId
                    );

                const variant =
                    cleanString(
                        item.variant
                    );

                const quantity =
                    number(
                        item.quantity
                    );


                if (
                    !productId ||
                    quantity <= 0
                ) {

                    throw new Error(
                        "Invalid product quantity."
                    );
                }


                const key =
                    productId +
                    "||" +
                    variant;


                requested.set(
                    key,
                    (
                        requested.get(key) ||
                        0
                    ) +
                    quantity
                );
            });


            /*
             * Read every product.
             */

            const productRefs =
                new Map();


            const productSnaps =
                new Map();


            for (
                const item of items
            ) {

                const productId =
                    cleanString(
                        item.productId
                    );


                if (
                    productRefs.has(
                        productId
                    )
                ) {
                    continue;
                }


                const productRef =
                    doc(
                        db,
                        COLLECTIONS.products,
                        productId
                    );


                const productSnap =
                    await transaction.get(
                        productRef
                    );


                if (
                    !productSnap.exists()
                ) {

                    throw new Error(
                        "Product not found: " +
                        productId
                    );
                }


                productRefs.set(
                    productId,
                    productRef
                );


                productSnaps.set(
                    productId,
                    productSnap
                );
            }


            /*
             * Validate and calculate.
             */

            const validatedItems = [];

            let totalCost = 0;


            for (
                const [key, requestedQty]
                of requested
            ) {

                const parts =
                    key.split("||");


                const productId =
                    parts[0];


                const variant =
                    parts.slice(1).join("||");


                const product =
                    productSnaps
                        .get(productId)
                        .data();


                if (
                    String(
                        product.StoreId
                    ) !==
                    String(storeId)
                ) {

                    throw new Error(
                        "Product belongs to another store."
                    );
                }


                const productName =
                    cleanString(
                        product.Name
                    );


                const cost =
                    number(
                        product.Cost
                    );


                const attributes =
                    parseAttributes(
                        product
                    );


                let availableQty = 0;


                if (
                    Object.keys(
                        attributes
                    ).length > 0
                ) {

                    if (!variant) {

                        throw new Error(
                            "Please select a variant for " +
                            productName +
                            "."
                        );
                    }


                    if (
                        attributes[
                            variant
                        ] === undefined
                    ) {

                        throw new Error(
                            `Variant "${variant}" does not exist for ${productName}.`
                        );
                    }


                    availableQty =
                        number(
                            attributes[
                                variant
                            ]
                        );

                }

                else {

                    availableQty =
                        number(
                            product.Qty
                        );
                }


                if (
                    requestedQty >
                    availableQty
                ) {

                    throw new Error(
                        productName +
                        (
                            variant
                                ? " (" +
                                  variant +
                                  ")"
                                : ""
                        ) +
                        " only has " +
                        availableQty +
                        " in stock."
                    );
                }


                const lineCost =
                    cost *
                    requestedQty;


                validatedItems.push({

                    productId,

                    productName,

                    variant,

                    quantity:
                        requestedQty,

                    cost,

                    lineCost,

                    productRef:
                        productRefs.get(
                            productId
                        ),

                    product:
                        product
                });


                totalCost +=
                    lineCost;
            }


            /*
             * WRITE PHASE
             */

            const productSummary =
                validatedItems
                    .map(item => {

                        let text =
                            item.productName;


                        if (
                            item.variant
                        ) {

                            text +=
                                " (" +
                                item.variant +
                                ")";
                        }


                        text +=
                            " x" +
                            item.quantity;


                        return text;

                    })
                    .join(", ");


            const customerTotal =
                sellingPrice +
                deliveryFee;


            const profit =
                sellingPrice -
                totalCost;


            /*
             * Deduct stock.
             */

            const updatedProducts =
                new Map();


            validatedItems.forEach(
                item => {

                    if (
                        updatedProducts.has(
                            item.productId
                        )
                    ) {
                        return;
                    }


                    const product =
                        {
                            ...item.product
                        };


                    const related =
                        validatedItems.filter(
                            x =>
                                x.productId ===
                                item.productId
                        );


                    const attributes =
                        parseAttributes(
                            product
                        );


                    if (
                        Object.keys(
                            attributes
                        ).length > 0
                    ) {

                        related.forEach(
                            line => {

                                attributes[
                                    line.variant
                                ] =
                                    number(
                                        attributes[
                                            line.variant
                                        ]
                                    ) -
                                    line.quantity;


                                if (
                                    attributes[
                                        line.variant
                                    ] <= 0
                                ) {

                                    delete attributes[
                                        line.variant
                                    ];
                                }
                            }
                        );


                        const totalQty =
                            Object.values(
                                attributes
                            ).reduce(
                                (
                                    total,
                                    value
                                ) =>
                                    total +
                                    number(
                                        value
                                    ),
                                0
                            );


                        transaction.update(
                            item.productRef,
                            {
                                Qty:
                                    totalQty,

                                Attributes:
                                    attributes
                            }
                        );

                    }

                    else {

                        let newQty =
                            number(
                                product.Qty
                            );


                        related.forEach(
                            line => {

                                newQty -=
                                    line.quantity;
                            }
                        );


                        if (
                            newQty < 0
                        ) {

                            throw new Error(
                                "Stock cannot become negative."
                            );
                        }


                        transaction.update(
                            item.productRef,
                            {
                                Qty:
                                    newQty
                            }
                        );
                    }


                    updatedProducts.set(
                        item.productId,
                        true
                    );
                }
            );


            /*
             * Create order.
             */

            transaction.set(
                orderRef,
                {
                    OrderId:
                        orderId,

                    Timestamp:
                        timestamp,

                    User:
                        currentUser || "",

                    StoreId:
                        storeId,

                    StoreName:
                        store.StoreName || "",

                    Products:
                        productSummary,

                    TotalCost:
                        totalCost,

                    SellingPrice:
                        sellingPrice,

                    DeliveryFee:
                        deliveryFee,

                    CustomerTotal:
                        customerTotal,

                    Profit:
                        profit,

                    TrackingNumber:
                        trackingNumber,

                    Status:
                        "Waiting",

                    StockRestored:
                        false
                }
            );


            /*
             * Create order items.
             */

            validatedItems.forEach(
                (item, index) => {

                    const itemId =
                        orderId +
                        "-ITEM-" +
                        (index + 1);


                    transaction.set(
                        doc(
                            db,
                            COLLECTIONS.orderItems,
                            itemId
                        ),
                        {
                            OrderItemId:
                                itemId,

                            OrderId:
                                orderId,

                            ProductId:
                                item.productId,

                            ProductName:
                                item.productName,

                            Variant:
                                item.variant,

                            Quantity:
                                item.quantity,

                            Cost:
                                item.cost,

                            LineCost:
                                item.lineCost
                        }
                    );
                }
            );


            return {
                OrderId:
                    orderId,

                Timestamp:
                    timestamp,

                User:
                    currentUser || "",

                StoreId:
                    storeId,

                StoreName:
                    store.StoreName || "",

                Products:
                    productSummary,

                TotalCost:
                    totalCost,

                SellingPrice:
                    sellingPrice,

                DeliveryFee:
                    deliveryFee,

                CustomerTotal:
                    customerTotal,

                Profit:
                    profit,

                TrackingNumber:
                    trackingNumber,

                Status:
                    "Waiting",

                StockRestored:
                    false
            };
        }
    );
}


/* =========================================================
   ORDERS LIST
========================================================= */

function renderOrdersList() {

    const container =
        document.getElementById(
            "ordersList"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (
        !allOrders ||
        allOrders.length === 0
    ) {

        container.innerHTML = `
            <small
                style="color:var(--text-muted);">
                No orders yet.
            </small>
        `;

        return;
    }


    [...allOrders]
        .sort(
            (a, b) =>
                new Date(
                    b.Timestamp || 0
                ) -
                new Date(
                    a.Timestamp || 0
                )
        )
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
                number(
                    order.Profit
                );


            const status =
                order.Status ||
                "Waiting";


            let statusColor =
                "#6b7280";


            if (
                status ===
                "Delivered"
            ) {
                statusColor =
                    "var(--success)";
            }


            if (
                status ===
                "Waiting for return"
            ) {
                statusColor =
                    "#f59e0b";
            }


            if (
                status ===
                "Returned" ||
                status ===
                "Cancelled"
            ) {
                statusColor =
                    "var(--danger)";
            }


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

                        ${escapeHtml(
                            status
                        )}

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
                            $${number(
                                order.TotalCost
                            ).toFixed(2)}
                        </strong>
                    </div>


                    <div>
                        <small>
                            Selling
                        </small>

                        <strong>
                            $${number(
                                order.SellingPrice
                            ).toFixed(2)}
                        </strong>
                    </div>


                    <div>
                        <small>
                            Delivery
                        </small>

                        <strong>
                            $${number(
                                order.DeliveryFee
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
                                ${
                                    profit >= 0
                                        ? "var(--success)"
                                        : "var(--danger)"
                                };
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
   UPDATE ORDER STATUS
========================================================= */

async function markOrderReturned(
    orderId
) {

    if (
        !confirm(
            "Confirm that this order has actually returned?"
        )
    ) {
        return;
    }


    try {

        await updateOrderStatus(
            orderId,
            "Returned"
        );


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
   FIRESTORE ORDER STATUS
========================================================= */

async function updateOrderStatus(
    orderId,
    newStatus
) {

    await requireAuth();


    const allowedStatuses = [
        "Waiting",
        "Delivered",
        "Waiting for return",
        "Returned",
        "Cancelled"
    ];


    if (
        !allowedStatuses.includes(
            newStatus
        )
    ) {

        throw new Error(
            "Invalid order status."
        );
    }


    const orderRef =
        doc(
            db,
            COLLECTIONS.orders,
            orderId
        );


    await runTransaction(
        db,
        async transaction => {

            /*
             * READ ORDER FIRST.
             */

            const orderSnap =
                await transaction.get(
                    orderRef
                );


            if (
                !orderSnap.exists()
            ) {

                throw new Error(
                    "Order not found."
                );
            }


            const order =
                orderSnap.data();


            const currentStatus =
                cleanString(
                    order.Status
                );


            const alreadyRestored =
                order.StockRestored === true ||
                String(
                    order.StockRestored
                ).toUpperCase() ===
                    "TRUE";


            /*
             * Delivered.
             */

            if (
                newStatus ===
                "Delivered"
            ) {

                if (
                    currentStatus !==
                    "Delivered"
                ) {

                    const sellingPrice =
                        number(
                            order.SellingPrice
                        );


                    if (
                        sellingPrice < 0
                    ) {

                        throw new Error(
                            "Invalid selling price."
                        );
                    }


                    if (
                        sellingPrice > 0
                    ) {

                        const txId =
                            makeId("TX-");


                        transaction.set(
                            doc(
                                db,
                                COLLECTIONS.transactions,
                                txId
                            ),
                            {
                                Timestamp:
                                    nowISO(),

                                User:
                                    order.User ||
                                    currentUser ||
                                    "",

                                Action:
                                    "Add",

                                Amount:
                                    sellingPrice,

                                Category:
                                    "Work",

                                Profile:
                                    "",

                                Notes:
                                    "Delivered Order " +
                                    orderId +
                                    " | Store: " +
                                    (
                                        order.StoreName ||
                                        ""
                                    ) +
                                    " | Profit: " +
                                    number(
                                        order.Profit
                                    )
                            }
                        );
                    }
                }


                transaction.update(
                    orderRef,
                    {
                        Status:
                            "Delivered"
                    }
                );


                return;
            }


            /*
             * Waiting.
             */

            if (
                newStatus ===
                "Waiting"
            ) {

                transaction.update(
                    orderRef,
                    {
                        Status:
                            "Waiting"
                    }
                );

                return;
            }


            /*
             * Waiting for return.
             */

            if (
                newStatus ===
                "Waiting for return"
            ) {

                transaction.update(
                    orderRef,
                    {
                        Status:
                            "Waiting for return"
                    }
                );

                return;
            }


            /*
             * Returned / Cancelled.
             *
             * Restore exact OrderItems once.
             */

            if (
                (
                    newStatus ===
                        "Returned" ||
                    newStatus ===
                        "Cancelled"
                ) &&
                !alreadyRestored
            ) {

                const itemsQuery =
                    query(
                        collection(
                            db,
                            COLLECTIONS.orderItems
                        ),
                        where(
                            "OrderId",
                            "==",
                            orderId
                        )
                    );


                const itemsSnapshot =
                    await getDocs(
                        itemsQuery
                    );


                if (
                    itemsSnapshot.empty
                ) {

                    throw new Error(
                        "No products found for this order."
                    );
                }


                const productChanges =
                    new Map();


                itemsSnapshot.docs
                    .forEach(
                        itemDoc => {

                            const item =
                                itemDoc.data();


                            const productId =
                                cleanString(
                                    item.ProductId
                                );


                            if (
                                !productChanges.has(
                                    productId
                                )
                            ) {

                                productChanges.set(
                                    productId,
                                    []
                                );
                            }


                            productChanges
                                .get(
                                    productId
                                )
                                .push(
                                    item
                                );
                        }
                    );


                /*
                 * Read all affected products
                 * before writing.
                 */

                const productSnapshots =
                    new Map();


                for (
                    const productId
                    of productChanges.keys()
                ) {

                    const productRef =
                        doc(
                            db,
                            COLLECTIONS.products,
                            productId
                        );


                    const productSnap =
                        await transaction.get(
                            productRef
                        );


                    if (
                        !productSnap.exists()
                    ) {

                        throw new Error(
                            "Product " +
                            productId +
                            " no longer exists."
                        );
                    }


                    productSnapshots.set(
                        productId,
                        {
                            ref:
                                productRef,

                            data:
                                productSnap.data()
                        }
                    );
                }


                /*
                 * Restore stock.
                 */

                for (
                    const [
                        productId,
                        items
                    ]
                    of productChanges
                ) {

                    const productInfo =
                        productSnapshots.get(
                            productId
                        );


                    const product =
                        productInfo.data;


                    const attributes =
                        parseAttributes(
                            product
                        );


                    const hasVariants =
                        Object.keys(
                            attributes
                        ).length > 0;


                    if (
                        hasVariants
                    ) {

                        items.forEach(
                            item => {

                                const variant =
                                    cleanString(
                                        item.Variant
                                    );


                                if (
                                    !variant
                                ) {

                                    throw new Error(
                                        "Missing variant while restoring " +
                                        product.Name
                                    );
                                }


                                attributes[
                                    variant
                                ] =
                                    number(
                                        attributes[
                                            variant
                                        ]
                                    ) +
                                    number(
                                        item.Quantity
                                    );
                            }
                        );


                        const totalQty =
                            Object.values(
                                attributes
                            ).reduce(
                                (
                                    total,
                                    value
                                ) =>
                                    total +
                                    number(
                                        value
                                    ),
                                0
                            );


                        transaction.update(
                            productInfo.ref,
                            {
                                Qty:
                                    totalQty,

                                Attributes:
                                    attributes
                            }
                        );

                    }

                    else {

                        const added =
                            items.reduce(
                                (
                                    total,
                                    item
                                ) =>
                                    total +
                                    number(
                                        item.Quantity
                                    ),
                                0
                            );


                        transaction.update(
                            productInfo.ref,
                            {
                                Qty:
                                    number(
                                        product.Qty
                                    ) +
                                    added
                            }
                        );
                    }
                }


                transaction.update(
                    orderRef,
                    {
                        Status:
                            newStatus,

                        StockRestored:
                            true
                    }
                );


                return;
            }


            transaction.update(
                orderRef,
                {
                    Status:
                        newStatus
                }
            );
        }
    );
}


/* =========================================================
   QR SCANNER
========================================================= */

async function openQrScanner() {

    const modal =
        document.getElementById(
            "qrScannerModal"
        );


    if (!modal) {
        return;
    }


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

            () => {}
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

        } catch (e) {}


        try {

            await qrScanner.clear();

        } catch (e) {}


        qrScanner = null;
    }


    if (modal) {

        modal.style.display =
            "none";
    }
}


/* =========================================================
   EXTRACT TRACKING NUMBER
========================================================= */

function extractTrackingNumber(
    value
) {

    const text =
        String(
            value || ""
        ).trim();


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
                last
                    .toUpperCase()
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
   RETURN SCANNER
========================================================= */

function openReturnScanner() {

    const log =
        document.getElementById(
            "returnScanLog"
        );


    if (log) {
        log.innerHTML = "";
    }


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

            () => {}
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

        } catch (e) {}


        try {

            await returnScanner.clear();

        } catch (e) {}


        returnScanner = null;
    }


    returnScanCooldown.clear();


    document.getElementById(
        "returnScannerModal"
    ).style.display =
        "none";
}


function logReturnScan(
    message,
    type
) {

    const log =
        document.getElementById(
            "returnScanLog"
        );


    if (!log) {
        return;
    }


    const entry =
        document.createElement(
            "div"
        );


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


async function handleReturnScan(
    decodedText
) {

    const trackingNumber =
        extractTrackingNumber(
            decodedText
        );


    if (!trackingNumber) {
        return;
    }


    const key =
        trackingNumber.toLowerCase();


    const now =
        Date.now();


    const lastAttempt =
        returnScanCooldown.get(
            key
        );


    if (
        lastAttempt &&
        now - lastAttempt <
            4000
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
                cleanString(
                    o.TrackingNumber
                ).toLowerCase() ===
                key
        );


    if (!order) {

        logReturnScan(
            `No order found for tracking ${trackingNumber}`,
            "error"
        );

        return;
    }


    if (
        order.Status ===
        "Returned"
    ) {

        logReturnScan(
            `${trackingNumber} — already marked Returned`,
            "info"
        );

        return;
    }


    if (
        order.Status ===
        "Cancelled"
    ) {

        logReturnScan(
            `${trackingNumber} — order was Cancelled, skipping`,
            "info"
        );

        return;
    }


    try {

        await updateOrderStatus(
            order.OrderId,
            "Returned"
        );


        logReturnScan(
            `✔ ${trackingNumber} — ${order.Products || "products"} restored to stock`,
            "success"
        );


        /*
         * Refresh without stopping scanner.
         */

        loadData();

    }

    catch (error) {

        logReturnScan(
            `✘ ${trackingNumber} — ${error.message || "failed"}`,
            "error"
        );


        returnScanCooldown.delete(
            key
        );
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
   MODAL EVENTS
========================================================= */

function setupModalEvents() {

    window.addEventListener(
        "click",
        event => {

            const profileModal =
                document.getElementById(
                    "profileModal"
                );


            if (
                profileModal &&
                event.target ===
                    profileModal
            ) {

                closeModal();
            }
        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !==
                "Escape"
            ) {
                return;
            }


            closeModal();

            closeProductModal();

            closeAdModal();

            closeQrScanner();

            closeReturnScanner();
        }
    );
}


/* =========================================================
   STARTUP
========================================================= */

async function startup() {

    try {

        await requireAuth();

        setupMoneyForm();

        setupCheckoutEvents();

        setupModalEvents();

        handleCategoryChange();

        renderCheckoutItems();


        console.log(
            "EcoTrack Firebase initialized."
        );


    }

    catch (error) {

        console.error(
            "Firebase startup error:",
            error
        );
    }
}


document.addEventListener(
    "DOMContentLoaded",
    startup
);


/* =========================================================
   EXPOSE FUNCTIONS TO HTML
=========================================================

   Your existing HTML uses onclick / onchange handlers.
   ES modules are normally scoped, so these functions need
   to be placed on window.
========================================================= */

Object.assign(
    window,
    {

        selectUser,

        switchUser,

        switchTab,

        handleCategoryChange,

        loadData,

        openProfile,

        openDebtProfile,

        submitModalDebt,

        showModalHistory,

        closeModal,

        cancelTransaction,

        createStore,

        renderStoresList,

        openStoreDetail,

        backToStores,

        renderStoreDetail,

        openAddProductModal,

        editProduct,

        closeProductModal,

        submitProduct,

        addNewVariantInline,

        adjustVariantInline,

        openAddAdModal,

        closeAdModal,

        submitAd,

        renderCheckoutStores,

        checkoutStoreChanged,

        checkoutProductChanged,

        getProductTotalQty,

        addCheckoutProduct,

        removeCheckoutProduct,

        renderCheckoutItems,

        updateCheckoutSummary,

        createCheckoutOrder,

        renderOrdersList,

        markOrderReturned,

        openQrScanner,

        closeQrScanner,

        extractTrackingNumber,

        openReturnScanner,

        startReturnScanner,

        closeReturnScanner,

        handleReturnScan,

        logReturnScan
    }
);
