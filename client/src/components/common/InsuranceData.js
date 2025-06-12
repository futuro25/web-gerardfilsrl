function InsuranceData({ insuranceInfo }) {
    return (
        <div className="border w-full h-[180px] p-4 pb-8">
            <div className="flex gap-2">
                <label className="font-bold text-lg">{insuranceInfo?.plan}</label>
            </div>
            <div className="flex gap-2">
                <label className="text-lg">{insuranceInfo?.address}</label>
            </div>
            <div className="flex gap-2">
                <label className="text-lg">{insuranceInfo?.city}</label>
            </div>
            <div className="flex gap-2">
                <label>CUIT: {insuranceInfo?.cuit}</label>
            </div>
            <div className="flex gap-2">
                <label>Categoria: {insuranceInfo?.category}</label>
            </div>
            <div className="flex gap-2">
                <label>Cond de Venta: CONTADO</label>
            </div>
        </div>
    );
}

export default InsuranceData;